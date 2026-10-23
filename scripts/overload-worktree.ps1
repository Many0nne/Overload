<#
.SYNOPSIS
  Cree, reutilise et demarre (ou arrete, ou supprime) un worktree Overload avec son propre Supabase local et ses ports.

.DESCRIPTION
  Une branche = un worktree worktrees\overload-<slug> = un slot N (le checkout principal etant le slot 0) :
  - Supabase local isole : project_id overload-<slug>, ports 54320..54329 + 100*N (API 54321+100*N) ;
  - Vite dev 5173+100*N, preview E2E 4173+100*N (E2E_PORT), inspecteur edge 8083+N.
  Rien de versionne n'est modifie : la CLI Supabase lit supabase\.env (SUPABASE_PROJECT_ID, SUPABASE_API_PORT...),
  l'app lit app\.env.local (copie du checkout principal, VITE_SUPABASE_URL realigne, E2E_PORT ajoute).
  Dans les worktrees, Supabase demarre sans logflare, vector, studio ni postgres-meta (-Studio pour les garder).

  Idempotent : a relancer sans risque au debut de chaque tache. Un worktree deja present sur la bonne branche est
  reutilise (modifications et slot conserves, ports realignes), npm ci n'est relance que si un package-lock.json a change.
  Par defaut le script demarre Supabase (`supabase start`) puis `npm run dev` en arriere-plan (journal .dev.log,
  pid .dev.pid dans le worktree) et attend que l'API Supabase et Vite repondent. -NoUp : sans demarrer.

  Registre de nettoyage (worktrees\.owners.json, lu par overload-worktree-cleanup.ps1) : la session Claude qui lance le
  script est inscrite comme utilisatrice du worktree. Quand tous ses threads T3 sont settled, la stack est arretee ;
  quand ils sont archives, le worktree est supprime (si tout est commite et pousse).

.EXAMPLE
  .\scripts\overload-worktree.ps1 feature/stats             # cree/reutilise et demarre (branche creee depuis dev si absente)
  .\scripts\overload-worktree.ps1 fix/sync -Base feature/x  # nouvelle branche creee depuis une autre base
  .\scripts\overload-worktree.ps1 feature/stats -NoUp       # sans demarrer Supabase ni Vite
  .\scripts\overload-worktree.ps1 feature/stats -Studio     # avec Supabase Studio (port 54323+100*N)
  .\scripts\overload-worktree.ps1 feature/stats -Stop       # arrete Vite et Supabase (donnees conservees)
  .\scripts\overload-worktree.ps1 feature/stats -Remove     # arrete, efface la base, supprime le worktree (branche conservee)

  Pour /delegate :
  .\scripts\overload-worktree.ps1 feature/x -NoUp -NoRegister     # creer sans inscrire la session courante
  .\scripts\overload-worktree.ps1 feature/x -RegisterThread <id>  # inscrire seulement un thread T3 (rien d'autre)
#>
param(
  [Parameter(Position = 0, Mandatory = $true)][string]$Branch,
  [string]$Base = 'dev',
  [int]$Slot = 0,
  [switch]$NoUp,
  [switch]$Studio,
  [switch]$Stop,
  [switch]$Remove,
  [switch]$NoRegister,
  [string]$RegisterThread
)

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$worktrees = Join-Path $root 'worktrees'
$slug = $Branch -replace '[^A-Za-z0-9._-]', '-'
$project = "overload-$slug"
$dir = Join-Path $worktrees $project
$appDir = Join-Path $dir 'app'
$supabaseEnv = Join-Path $dir 'supabase\.env'
$appEnv = Join-Path $appDir '.env.local'
$pidFile = Join-Path $dir '.dev.pid'
$logFile = Join-Path $dir '.dev.log'
$ownersFile = Join-Path $worktrees '.owners.json'

# Ports du checkout principal (slot 0), decales de 100*N par slot (inspecteur edge : +N).
$supabasePorts = [ordered]@{
  SUPABASE_API_PORT              = 54321
  SUPABASE_DB_PORT               = 54322
  SUPABASE_DB_SHADOW_PORT        = 54320
  SUPABASE_DB_POOLER_PORT        = 54329
  SUPABASE_STUDIO_PORT           = 54323
  SUPABASE_LOCAL_SMTP_PORT       = 54324
  SUPABASE_ANALYTICS_PORT        = 54327
}

# Cette methode permet de lire le registre des worktrees lorsqu'on doit l'enrichir ou le nettoyer.
function Get-Owners {
  if (Test-Path $ownersFile) { return @(Get-Content $ownersFile -Raw | ConvertFrom-Json) }
  return @()
}

# Cette methode permet d'inscrire la session Claude courante (ou le thread T3 donne) comme utilisatrice de la branche
# lorsque le script cree ou reutilise un worktree depuis Claude Code, ou quand /delegate a cree son thread.
function Register-Owner([string]$Thread) {
  $session = if ($Thread) { $null } else { $env:CLAUDE_CODE_SESSION_ID }
  if (-not ($session -or $Thread)) { return }
  New-Item -ItemType Directory -Force $worktrees | Out-Null
  # @() : PowerShell deroule le tableau renvoye, une seule entree reviendrait comme objet nu (sans +=).
  $owners = @(Get-Owners)
  $entry = $owners | Where-Object { $_.branch -eq $Branch } | Select-Object -First 1
  if (-not $entry) {
    $entry = [pscustomobject]@{ branch = $Branch; sessions = @(); threads = @() }
    $owners += $entry
  }
  $t = $Thread
  if ($session) {
    if ($session -notin $entry.sessions) { $entry.sessions = @($entry.sessions) + $session }
    # Le thread T3 (stable meme apres /clear) ; vide si la session ne tourne pas dans T3.
    $t = python -I (Join-Path $PSScriptRoot 't3_threads.py') thread-of $session 2>$null
  }
  if ($t -and $t -notin $entry.threads) { $entry.threads = @($entry.threads) + $t }
  ConvertTo-Json @($owners) -Depth 4 | Set-Content $ownersFile
}

# Cette methode permet de retirer la branche du registre lorsque son worktree vient d'etre supprime.
function Unregister-Owner {
  if (-not (Test-Path $ownersFile)) { return }
  $owners = @(Get-Owners | Where-Object { $_.branch -ne $Branch })
  ConvertTo-Json @($owners) -Depth 4 | Set-Content $ownersFile
}

# Cette methode permet de savoir si une ref git existe dans le depot principal.
function Test-Ref([string]$Ref) {
  git -C $root show-ref --verify --quiet $Ref
  return ($LASTEXITCODE -eq 0)
}

# Cette methode permet de savoir si le dossier est un worktree enregistre du depot (et pas un reliquat).
function Test-WorktreeRegistered {
  $target = (Resolve-Path $dir).Path -replace '\\', '/'
  [bool](git -C $root worktree list --porcelain | Where-Object { $_ -eq "worktree $target" })
}

# Cette methode permet de savoir si un port local est deja ecoute par un processus.
function Test-PortBusy([int]$Port) {
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

# Cette methode permet de lire le slot d'un worktree depuis le SUPABASE_API_PORT de son supabase\.env ; 0 si absent.
function Get-SlotOf([string]$EnvPath) {
  if (-not (Test-Path $EnvPath)) { return 0 }
  $m = Select-String -Path $EnvPath -Pattern '^SUPABASE_API_PORT=(\d+)' | Select-Object -First 1
  if ($m) { return [int](([int]$m.Matches[0].Groups[1].Value - 54321) / 100) }
  return 0
}

# Cette methode permet de fixer KEY=valeur dans un fichier .env lorsque la cle existe deja ou non (les autres lignes sont gardees).
function Set-EnvVar([string]$Path, [string]$Key, [string]$Value) {
  $text = if (Test-Path $Path) { Get-Content -Raw $Path } else { '' }
  if ($text -match "(?m)^$Key=") { $text = [regex]::Replace($text, "(?m)^$Key=.*$", "$Key=$Value") }
  else { $text = $text.TrimEnd() + "`n$Key=$Value`n" }
  Set-Content -Path $Path -Value $text.TrimStart() -NoNewline
}

# Cette methode permet de lancer la CLI Supabase du worktree (version figee par son package-lock) depuis sa racine,
# ou supabase\.env fixe le projet et les ports. Renvoie la sortie standard.
function Invoke-Supabase([string[]]$CliArgs) {
  Push-Location $dir
  try { return (npx --no-install supabase @CliArgs) } finally { Pop-Location }
}

# Cette methode permet de savoir si la base Supabase du worktree tourne (container supabase_db_<projet>).
function Test-SupabaseUp {
  [bool](docker ps --filter "name=^supabase_db_$project$" --format '{{.Names}}' 2>$null)
}

# Cette methode permet de renvoyer le code HTTP d'une URL, ou $null si rien ne repond.
function Get-UrlCode([string]$Url, [hashtable]$Headers = @{}) {
  try { return (Invoke-WebRequest -Uri $Url -Headers $Headers -TimeoutSec 3 -SkipHttpErrorCheck).StatusCode } catch { return $null }
}

# Cette methode permet d'attendre que Vite reponde 200 lorsqu'il demarre ; s'arrete apres 60 s,
# ou des que le processus de dev est mort. Renvoie le dernier code.
function Wait-Vite([string]$Url, [int]$DevPid) {
  $code = $null
  for ($i = 0; $i -lt 60; $i++) {
    $code = Get-UrlCode $Url
    if ($code -eq 200) { break }
    if (-not (Get-Process -Id $DevPid -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Seconds 1
  }
  return $code
}

# Cette methode permet d'arreter le Vite du worktree : arbre du pid enregistre, puis tout processus lance depuis
# ce worktree qui ecoute encore sur son port. Renvoie $true si quelque chose a ete arrete.
function Stop-Dev([int]$VitePort) {
  $stopped = $false
  if (Test-Path $pidFile) {
    $devPid = [int](Get-Content $pidFile)
    if (Get-Process -Id $devPid -ErrorAction SilentlyContinue) { taskkill /PID $devPid /T /F *> $null; $stopped = $true }
    Remove-Item $pidFile
  }
  $listeners = @(Get-NetTCPConnection -LocalPort $VitePort -State Listen -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty OwningProcess -Unique)
  foreach ($p in $listeners) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $p"
    if ($proc -and $proc.CommandLine -like "*$dir*") { taskkill /PID $p /T /F *> $null; $stopped = $true }
  }
  return $stopped
}

# Cette methode permet d'installer les dependances d'un dossier (racine ou app) lorsqu'elles manquent
# ou que son package-lock.json a change depuis la derniere installation.
function Install-Deps([string]$Path) {
  $installed = Join-Path $Path 'node_modules\.package-lock.json'
  $lock = Join-Path $Path 'package-lock.json'
  if ((Test-Path $installed) -and (Get-Item $lock).LastWriteTime -le (Get-Item $installed).LastWriteTime) { return }
  Push-Location $Path
  try {
    npm ci --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm ci a echoue dans $Path" }
  } finally { Pop-Location }
}

$exists = Test-Path $dir
$currentSlot = if ($exists) { Get-SlotOf $supabaseEnv } else { 0 }

if ($RegisterThread) {
  Register-Owner $RegisterThread
  Write-Host "Thread $RegisterThread inscrit pour le nettoyage de '$Branch'."
  return
}

if ($Stop -or $Remove) {
  if ($exists -and $currentSlot -gt 0) {
    $s = Stop-Dev (5173 + 100 * $currentSlot)
    Write-Host $(if ($s) { "Vite arrete." } else { "Aucun Vite en cours." })
    if (Test-SupabaseUp) {
      # -Remove efface aussi les volumes (base, stockage) ; -Stop les garde pour reprendre plus tard.
      $stopArgs = if ($Remove) { @('stop', '--no-backup') } else { @('stop') }
      Invoke-Supabase $stopArgs | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "supabase stop a echoue dans $dir" }
      Write-Host "Supabase '$project' arrete$(if ($Remove) { ' (volumes supprimes)' })."
    }
  }
  if ($Stop) { return }
}

if ($Remove) {
  if (-not $exists) { Unregister-Owner; Write-Host "Rien a supprimer : pas de worktree $dir."; return }
  if (Test-WorktreeRegistered) {
    if (git -C $dir status --porcelain) { throw "Modifications non commitees dans $dir : commiter ou annuler avant -Remove." }
    # git n'arrive pas toujours a effacer node_modules sous Windows : on les supprime d'abord.
    @(Get-ChildItem -Path $dir -Directory -Recurse -Depth 1 -Filter node_modules -Force) | ForEach-Object {
      Remove-Item -Recurse -Force -LiteralPath $_.FullName -Confirm:$false
    }
    git -C $root worktree remove --force $dir
    if ($LASTEXITCODE -ne 0) { throw "Suppression echouee : fermer les serveurs/terminaux ouverts dans $dir (y compris le repertoire courant d'une session Claude), puis relancer -Remove." }
  } elseif (-not (Get-ChildItem -Path $dir -Recurse -File -Force)) {
    # Reliquat d'un -Remove interrompu : git a deja desinscrit le worktree, il ne reste que des dossiers vides.
    Remove-Item -Recurse -Force $dir -Confirm:$false
  } else {
    throw "$dir n'est pas un worktree git mais contient des fichiers : a verifier et supprimer a la main."
  }
  Unregister-Owner
  Write-Host "Worktree supprime (branche '$Branch' conservee)."
  return
}

# Verification du dossier existant avant toute action : reutilise s'il est sur la bonne branche, sinon on bloque.
if ($exists) {
  if (-not (Test-WorktreeRegistered)) { throw "$dir existe mais n'est pas un worktree du depot (reliquat ? -Remove puis relancer)." }
  $current = git -C $dir branch --show-current
  if ($current -ne $Branch) { throw "$dir est sur '$current' au lieu de '$Branch'." }
}
# Inscription apres la verification : un echec ne laisse pas d'entree orpheline dans le registre.
if (-not $NoRegister) { Register-Owner }

# Choix du slot : celui du worktree s'il existe, sinon le premier numero >= 1 libre (slots des worktrees et ports reellement libres).
if ($Slot -le 0) { $Slot = $currentSlot }
if ($Slot -le 0) {
  $used = @(Get-ChildItem -Path $worktrees -Directory -Filter 'overload-*' -ErrorAction SilentlyContinue |
      ForEach-Object { Get-SlotOf (Join-Path $_.FullName 'supabase\.env') })
  $Slot = 1
  while (($used -contains $Slot) -or (Test-PortBusy (54321 + 100 * $Slot)) -or (Test-PortBusy (5173 + 100 * $Slot))) { $Slot++ }
}
$apiPort = 54321 + 100 * $Slot
$vitePort = 5173 + 100 * $Slot
$e2ePort = 4173 + 100 * $Slot

if (-not $exists) {
  $hasOrigin = (git -C $root remote) -contains 'origin'
  if ($hasOrigin) { git -C $root fetch origin --quiet }
  # Branche existante (locale ou origin) : on la reprend ; sinon creee depuis la base (origin si present).
  if (Test-Ref "refs/heads/$Branch") {
    git -C $root worktree add $dir $Branch
  } elseif ($hasOrigin -and (Test-Ref "refs/remotes/origin/$Branch")) {
    git -C $root worktree add --track -b $Branch $dir "origin/$Branch"
  } else {
    # Base locale en avance sur origin (commits pas encore pousses) : on part de la locale pour ne pas les perdre de vue.
    $start = $Base
    if ($hasOrigin -and (Test-Ref "refs/remotes/origin/$Base")) {
      git -C $root merge-base --is-ancestor "origin/$Base" $Base 2>$null
      $localAhead = ($LASTEXITCODE -eq 0) -and ((git -C $root rev-parse $Base) -ne (git -C $root rev-parse "origin/$Base"))
      if ($localAhead) { Write-Warning "'$Base' local est en avance sur origin/$Base : branche creee depuis le local (penser a pousser $Base)." }
      else { $start = "origin/$Base" }
    }
    git -C $root worktree add -b $Branch $dir $start
  }
  if ($LASTEXITCODE -ne 0) { throw "git worktree add a echoue" }
}

# supabase\.env : projet et ports du slot, lus automatiquement par la CLI Supabase (surcharge de config.toml).
Set-EnvVar $supabaseEnv 'SUPABASE_PROJECT_ID' $project
foreach ($k in $supabasePorts.Keys) { Set-EnvVar $supabaseEnv $k "$($supabasePorts[$k] + 100 * $Slot)" }
Set-EnvVar $supabaseEnv 'SUPABASE_EDGE_RUNTIME_INSPECTOR_PORT' "$(8083 + $Slot)"
Set-EnvVar $supabaseEnv 'SUPABASE_AUTH_SITE_URL' "http://localhost:$vitePort"

# Secrets des fonctions edge (VAPID...) : copie telle quelle depuis le checkout principal, a la creation seulement.
$functionsEnv = Join-Path $root 'supabase\functions\.env'
$wtFunctionsEnv = Join-Path $dir 'supabase\functions\.env'
if ((Test-Path $functionsEnv) -and -not (Test-Path $wtFunctionsEnv)) { Copy-Item $functionsEnv $wtFunctionsEnv }

# app\.env.local : copie du checkout principal (ou du modele) a la creation, puis URL Supabase et port E2E du slot.
if (-not (Test-Path $appEnv)) {
  $src = Join-Path $root 'app\.env.local'
  if (-not (Test-Path $src)) { $src = Join-Path $appDir '.env.example' }
  Copy-Item $src $appEnv
}
Set-EnvVar $appEnv 'VITE_SUPABASE_URL' "http://127.0.0.1:$apiPort"
Set-EnvVar $appEnv 'E2E_PORT' "$e2ePort"

# Dependances : racine (CLI Supabase, tsx) et app.
Install-Deps $dir
Install-Deps $appDir

# Avertissement : branche trop ancienne pour la preview E2E isolee (playwright.config.ts sans E2E_PORT).
if (-not (Select-String -Path (Join-Path $appDir 'playwright.config.ts') -Pattern 'E2E_PORT' -Quiet)) {
  Write-Warning "app\playwright.config.ts ignore E2E_PORT sur cette branche (rebaser sur dev) : npm run e2e utiliserait le port 4173 partage."
}

$supabaseCode = $null
$viteCode = $null
if (-not $NoUp) {
  if (-not (Test-SupabaseUp)) {
    if (Test-PortBusy $apiPort) { throw "Port $apiPort deja pris par un autre processus : liberer le port ou relancer avec -Slot <autre>." }
    $exclude = if ($Studio) { 'logflare,vector' } else { 'logflare,vector,studio,postgres-meta' }
    Push-Location $dir
    try { npx --no-install supabase start -x $exclude } finally { Pop-Location }
    if ($LASTEXITCODE -ne 0) { throw "supabase start a echoue dans $dir (Docker demarre ?)." }
  }
  # Cle anon de la stack du worktree (identique en local, mais on ne suppose rien) reportee dans app\.env.local.
  $status = Invoke-Supabase @('status', '-o', 'env')
  $anonKey = ($status | Select-String '^ANON_KEY="?([^"]*)"?$' | Select-Object -First 1).Matches[0].Groups[1].Value
  if ($anonKey) { Set-EnvVar $appEnv 'VITE_SUPABASE_ANON_KEY' $anonKey }
  $supabaseCode = Get-UrlCode "http://127.0.0.1:$apiPort/auth/v1/health" @{ apikey = $anonKey }

  $running = (Test-Path $pidFile) -and (Get-Process -Id ([int](Get-Content $pidFile)) -ErrorAction SilentlyContinue)
  if (-not $running) {
    if (Test-PortBusy $vitePort) { throw "Port $vitePort deja pris par un autre processus : liberer le port ou relancer avec -Slot <autre>." }
    $proc = Start-Process -FilePath (Get-Command pwsh).Source -WorkingDirectory $appDir -WindowStyle Hidden -PassThru `
      -ArgumentList '-NoProfile', '-NonInteractive', '-Command', "npm run dev -- --port $vitePort --strictPort *> ..\.dev.log"
    Set-Content -Path $pidFile -Value $proc.Id
  }
  $viteCode = Wait-Vite "http://localhost:$vitePort/" ([int](Get-Content $pidFile))
}

Write-Host ""
Write-Host "Worktree '$Branch' : $dir (slot $Slot)"
# Cette methode permet de formater l'etat d'une URL pour le resume ([OK (200)] attendu par les briefs /delegate).
function Format-State($Code) { if ($NoUp) { '' } elseif ($Code -eq 200) { '  [OK (200)]' } else { "  [NE REPOND PAS$(if ($Code) { " ($Code)" })]" } }
Write-Host "  app      : http://localhost:$vitePort$(Format-State $viteCode)"
Write-Host "  supabase : http://127.0.0.1:$apiPort$(Format-State $supabaseCode)  (projet $project, base 127.0.0.1:$(54322 + 100 * $Slot))"
if ($Studio) { Write-Host "  studio   : http://127.0.0.1:$(54323 + 100 * $Slot)" }
Write-Host "  mails    : http://127.0.0.1:$(54324 + 100 * $Slot)"
Write-Host "  e2e      : preview sur le port $e2ePort (npm run e2e depuis $appDir)"
if ($NoUp) { Write-Host "Stack non demarree (-NoUp) : relancer sans -NoUp pour demarrer Supabase et Vite." ; return }
Write-Host "  journal  : $logFile"
if ($supabaseCode -ne 200 -or $viteCode -ne 200) {
  throw "Demarrage incomplet (supabase=$supabaseCode app=$viteCode) : voir $logFile et ``npx supabase status`` dans $dir."
}
