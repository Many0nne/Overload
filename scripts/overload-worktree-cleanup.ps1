<#
.SYNOPSIS
  Libere les ressources des worktrees Overload dont les threads T3 ne sont plus actifs (settled, archives ou supprimes),
  en deux paliers :
  - PR de la branche pas encore mergee (ou pas de PR) : arret de la stack seulement (Vite + Supabase, donnees conservees)
    (reversible, relancer overload-worktree.ps1 <branche> pour reprendre) ;
  - PR de la branche mergee, ou fermee sans merge, et aucune PR encore ouverte : suppression du worktree et de sa stack
    (overload-worktree.ps1 -Remove) ; la branche locale est aussi supprimee si la PR est mergee, gardee si elle est fermee
    sans merge. Fermer ou archiver un thread ne supprime jamais rien a lui seul.
  Un thread settled qui recoit un nouveau message redevient actif : rien n'est touche. Une session inscrite
  pas encore rattachee a un thread (premier tour en cours) et active depuis moins de 30 min bloque aussi l'entree.
  Le lien worktree -> threads vient du registre worktrees\.owners.json, rempli par overload-worktree.ps1.
  Garde-fous de suppression : rien n'est supprime s'il reste des modifications non commitees, ou des commits
  absents d'origin (sauf ceux contenus dans une PR mergee, cas du squash-merge avec branche distante supprimee).
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

# Cette methode permet de lister les PR d'une branche (etat, commit de tete) lorsqu'il faut savoir si son travail est merge ;
# depot du compte Many0nne (le compte gh actif par defaut est un autre).
function Get-BranchPrs([string]$Branch) {
  $env:GH_TOKEN = gh auth token --user Many0nne 2>$null
  $json = gh pr list --repo Many0nne/Overload --head $Branch --state all --json number,state,headRefOid 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $json) { return @() }
  @($json | ConvertFrom-Json)
}

# Cette methode permet de dire pourquoi un worktree ne peut pas etre supprime sans perte lorsqu'il a du travail non pousse ;
# renvoie $null s'il est sur. Les commits deja contenus dans une PR mergee (squash-merge, branche distante supprimee) sont surs.
function Get-UnsafeReason([string]$Dir, [string]$Branch, $Prs) {
  if (@(git -C $Dir status --porcelain).Count -gt 0) { return 'modifications non commitees' }
  $local = @(git -C $Dir rev-list HEAD --not --remotes)
  # Branche rebasee et force-pushee : les anciennes versions des commits ont un equivalent (meme patch) sur origin.
  if ($local -and (git -C $Dir rev-parse --verify -q "refs/remotes/origin/$Branch")) {
    $alreadyPushed = @(git -C $Dir cherry "origin/$Branch" HEAD | Where-Object { $_ -like '- *' } | ForEach-Object { $_.Substring(2) })
    $local = @($local | Where-Object { $_ -notin $alreadyPushed })
  }
  foreach ($pr in @($Prs | Where-Object { $_.state -eq 'MERGED' })) {
    if (-not $local) { break }
    git -C $Dir cat-file -e "$($pr.headRefOid)^{commit}" 2>$null
    if ($LASTEXITCODE -ne 0) { continue }
    $inPr = @(git -C $Dir rev-list $pr.headRefOid)
    $local = @($local | Where-Object { $_ -notin $inPr })
  }
  if ($local.Count -eq 0) { return $null }
  return "$($local.Count) commit(s) absents d'origin"
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

    # Travail clos : PR mergee (ou fermee sans merge) et aucune PR encore ouverte sur la branche -> suppression.
    $prs = Get-BranchPrs $branch
    $open = @($prs | Where-Object { $_.state -eq 'OPEN' })
    $delivered = @($prs | Where-Object { $_.state -eq 'MERGED' }) -and -not $open
    $abandoned = -not $delivered -and @($prs | Where-Object { $_.state -eq 'CLOSED' }) -and -not $open

    # Palier 1 : threads termines mais travail non clos (PR ouverte ou absente) -> arret de la stack seulement.
    if (-not ($delivered -or $abandoned)) {
      $project = Split-Path -Leaf $dir
      $supabaseUp = [bool](docker ps --filter "name=^supabase_db_$project$" --format '{{.Names}}' 2>$null)
      if (-not ((Test-Path (Join-Path $dir '.dev.pid')) -or $supabaseUp)) { continue }
      if ($DryRun) { Write-Host "A ARRETER $branch"; continue }
      & $worktreeScript $branch -Stop *>&1 | Out-Null
      Write-Log "ARRETE $branch (threads termines, PR non mergee)"
      continue
    }

    # Dossier sans .git : reliquat vide d'un -Remove interrompu, git status y lirait le checkout principal.
    if (Test-Path (Join-Path $dir '.git')) {
      $reason = Get-UnsafeReason $dir $branch $prs
      if ($reason) { Write-Log "GARDE $branch (threads termines) : $reason" -Once; continue }
    }
    $why = if ($delivered) { 'PR mergee, threads termines' } else { 'PR fermee sans merge, threads termines' }
    if ($DryRun) { Write-Host "A SUPPRIMER $branch ($why) : overload-worktree.ps1 $branch -Remove"; continue }
    try {
      & $worktreeScript $branch -Remove *>&1 | Out-Null
      # PR mergee : la branche locale n'a plus d'usage (son travail est sur origin, verifie ci-dessus). Fermee sans merge : gardee.
      if ($delivered) {
        git -C $root branch -D $branch *>&1 | Out-Null
        if ($LASTEXITCODE -eq 0) { $why += ', branche locale supprimee' }
      }
      Write-Log "SUPPRIME $branch ($why)"
    } catch {
      Write-Log "ECHEC $branch : $($_.Exception.Message)" -Once
    }
  }
} finally { $mutex.ReleaseMutex() }
