<#
.SYNOPSIS
  Libere les ressources des worktrees Overload dont le travail est termine cote T3, en deux paliers :
  - tous les threads settled (ou settled + archives) : arret de la stack (Vite + Supabase, donnees conservees) (reversible, relancer
    overload-worktree.ps1 <branche> pour reprendre) ;
  - tous les threads archives ou supprimes : suppression (overload-worktree.ps1 -Remove).
  Un thread settled qui recoit un nouveau message redevient actif : rien n'est touche. Une session inscrite
  pas encore rattachee a un thread (premier tour en cours) et active depuis moins de 30 min bloque aussi l'entree.
  Le lien worktree -> threads vient du registre worktrees\.owners.json, rempli par overload-worktree.ps1.
  Garde-fous de suppression : rien n'est supprime s'il reste des modifications non commitees, ou des commits
  absents d'origin (sauf PR mergee, cas du squash-merge avec branche distante supprimee).
  Lance toutes les 10 minutes par la tache planifiee "Overload worktree cleanup" (install-cleanup-task.ps1) ;
  journal dans worktrees\.cleanup.log.

.EXAMPLE
  .\scripts\overload-worktree-cleanup.ps1 -DryRun
#>
param([switch]$DryRun)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$ownersFile = Join-Path $root 'worktrees\.owners.json'
$logFile = Join-Path $root 'worktrees\.cleanup.log'
$helper = Join-Path $PSScriptRoot 't3_threads.py'
$worktreeScript = Join-Path $PSScriptRoot 'overload-worktree.ps1'

# Cette methode permet de tracer une decision du nettoyage (console et journal) lorsqu'un worktree est arrete, garde ou supprime ;
# avec -Once, un message deja present dans la fin du journal n'est pas repete (execution toutes les 10 minutes).
function Write-Log([string]$Message, [switch]$Once) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm') $Message"
  Write-Host $line
  if ($DryRun) { return }
  if ($Once -and (Test-Path $logFile) -and (@(Get-Content $logFile -Tail 200) -replace '^\S+ \S+ ', '') -contains $Message) { return }
  Add-Content $logFile $line
}

# Cette methode permet de savoir si une session Claude a ecrit son transcript recemment (moins de 30 min),
# lorsqu'elle n'est pas encore rattachee a un thread T3 : elle est alors consideree comme active.
function Test-RecentSession([string]$SessionId) {
  $limit = (Get-Date).AddMinutes(-30)
  [bool](Get-ChildItem (Join-Path $HOME '.claude\projects\*') -Filter "$SessionId.jsonl" -File -ErrorAction SilentlyContinue |
    Where-Object { $_.LastWriteTime -gt $limit })
}

# Cette methode permet de dire pourquoi un worktree ne peut pas etre supprime sans perte lorsqu'il a du travail non pousse ;
# renvoie $null s'il est sur.
function Get-UnsafeReason([string]$Dir, [string]$Branch) {
  if (@(git -C $Dir status --porcelain).Count -gt 0) { return 'modifications non commitees' }
  $local = @(git -C $Dir rev-list HEAD --not --remotes)
  # Branche rebasee et force-pushee : les anciennes versions des commits ont un equivalent (meme patch) sur origin.
  if ($local -and (git -C $Dir rev-parse --verify -q "refs/remotes/origin/$Branch")) {
    $alreadyPushed = @(git -C $Dir cherry "origin/$Branch" HEAD | Where-Object { $_ -like '- *' } | ForEach-Object { $_.Substring(2) })
    $local = @($local | Where-Object { $_ -notin $alreadyPushed })
  }
  $unpushed = $local.Count
  if ($unpushed -eq 0) { return $null }
  # Depot du compte Many0nne (le compte gh actif par defaut est un autre).
  $env:GH_TOKEN = gh auth token --user Many0nne 2>$null
  $merged = gh pr list --repo Many0nne/Overload --head $Branch --state merged --json number --jq 'length' 2>$null
  if ([int]$merged -gt 0) { return $null }
  return "$unpushed commit(s) absents d'origin"
}

if (-not (Test-Path $ownersFile)) { return }
# Tache planifiee et lancement manuel peuvent se chevaucher : une seule execution a la fois.
$mutex = New-Object System.Threading.Mutex($false, 'Local\overload-worktree-cleanup')
if (-not $mutex.WaitOne(0)) { return }
try {
  git -C $root fetch origin --quiet 2>$null
  $owners = @(Get-Content $ownersFile -Raw | ConvertFrom-Json)
  foreach ($entry in $owners) {
    $branch = $entry.branch
    $dir = Join-Path $root "worktrees\overload-$($branch -replace '[^A-Za-z0-9._-]', '-')"

    # Threads connus, completes par les sessions resolues depuis (session lancee avant la creation de son thread).
    $threads = @($entry.threads | Where-Object { $_ })
    $recentUnresolved = $false
    foreach ($s in $entry.sessions) {
      $t = python -I $helper thread-of $s 2>$null
      if ($t) { if ($t -notin $threads) { $threads += $t } }
      elseif (Test-RecentSession $s) { $recentUnresolved = $true }
    }
    # Thread T3 tout juste lance : le lien session -> thread n'est ecrit qu'apres son premier tour.
    if ($recentUnresolved) { continue }
    if (-not $threads) { continue }  # session hors T3 (terminal) : jamais supprime automatiquement
    $states = python -I $helper status @threads | ConvertFrom-Json
    if (@($threads | Where-Object { $states.$_ -eq 'active' })) { continue }

    # Palier 1 : au moins un thread settled (pas encore archive) -> arret de la stack seulement.
    if (@($threads | Where-Object { $states.$_ -eq 'settled' })) {
      $project = Split-Path -Leaf $dir
      $supabaseUp = [bool](docker ps --filter "name=^supabase_db_$project$" --format '{{.Names}}' 2>$null)
      if (-not ((Test-Path (Join-Path $dir '.dev.pid')) -or $supabaseUp)) { continue }
      if ($DryRun) { Write-Host "A ARRETER $branch"; continue }
      & $worktreeScript $branch -Stop *>&1 | Out-Null
      Write-Log "ARRETE $branch (threads settled)"
      continue
    }

    if (Test-Path $dir) {
      $reason = Get-UnsafeReason $dir $branch
      if ($reason) { Write-Log "GARDE $branch (threads termines) : $reason" -Once; continue }
    }
    if ($DryRun) { Write-Host "A SUPPRIMER $branch : overload-worktree.ps1 $branch -Remove"; continue }
    try {
      & $worktreeScript $branch -Remove *>&1 | Out-Null
      Write-Log "SUPPRIME $branch (threads archives/supprimes : $($threads.Count))"
    } catch {
      Write-Log "ECHEC $branch : $($_.Exception.Message)" -Once
    }
  }
} finally { $mutex.ReleaseMutex() }
