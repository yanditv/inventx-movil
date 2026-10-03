#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Instala o actualiza InventX Movil en este equipo, publicado con HTTPS por Caddy y Tailscale.

.DESCRIPTION
  1. Verifica Node.js, Tailscale y el archivo .env.local.
  2. Instala dependencias y compila la app (npm ci + npm run build).
  3. Descarga Caddy (si falta) y genera el Caddyfile con el nombre *.ts.net de este equipo.
  4. Registra la app como tarea que arranca con Windows (se reinicia sola si se cae).
  5. Registra Caddy como servicio de Windows.
  6. Comprueba que https://<equipo>.<tailnet>.ts.net responde.

  Volver a ejecutarlo actualiza la instalacion (por ejemplo despues de "git pull").

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1
.EXAMPLE
  powershell -ExecutionPolicy Bypass -File deploy\instalar.ps1 -Dominio inventx.tail1234.ts.net -Puerto 3000
#>
param(
  # Nombre MagicDNS completo de este equipo. Si se omite, se toma de "tailscale status".
  [string]$Dominio,
  [int]$Puerto = 3000,
  # Donde se guardan caddy.exe, el Caddyfile y los logs.
  [string]$CarpetaServicio = "C:\InventX\movil"
)

$ErrorActionPreference = "Stop"
$App = Split-Path -Parent $PSScriptRoot
$NombreTarea = "InventX Movil"
$NombreServicio = "caddy-inventx"

function Paso($texto) { Write-Host "`n==> $texto" -ForegroundColor Cyan }
function Ok($texto) { Write-Host "    $texto" -ForegroundColor Green }
function Falla($texto) { Write-Host "`nERROR: $texto" -ForegroundColor Red; exit 1 }

# --- 1. Requisitos -----------------------------------------------------------
Paso "Verificando requisitos"
# Paquete de GitHub Releases: ya viene compilado (server.js) y trae su propio Node.js (node\node.exe).
# Copia del repositorio (git clone): se compila aqui con el Node.js instalado.
$Release = Test-Path (Join-Path $App "server.js")
$nodeIncluido = Join-Path $App "node\node.exe"
$node = if (Test-Path $nodeIncluido) { $nodeIncluido } else { (Get-Command node -ErrorAction SilentlyContinue).Source }
if (-not $node) { Falla "Node.js no esta instalado. Instale la version LTS desde https://nodejs.org" }
$versionNode = [int]((& $node -v).TrimStart("v").Split(".")[0])
if ($versionNode -lt 20) { Falla "Se necesita Node.js 20 o superior (hay $(& $node -v))." }
Ok "Node.js $(& $node -v)"

$tailscale = (Get-Command tailscale -ErrorAction SilentlyContinue).Source
if (-not $tailscale -and (Test-Path "C:\Program Files\Tailscale\tailscale.exe")) { $tailscale = "C:\Program Files\Tailscale\tailscale.exe" }
if (-not $tailscale) { Falla "Tailscale no esta instalado. Descarguelo de https://tailscale.com/download e inicie sesion." }
try { $estado = & $tailscale status --json | ConvertFrom-Json } catch { Falla "Tailscale no esta conectado. Abra Tailscale e inicie sesion." }
if ($estado.BackendState -ne "Running") { Falla "Tailscale no esta conectado (estado: $($estado.BackendState))." }
if (-not $Dominio) { $Dominio = $estado.Self.DNSName.TrimEnd(".") }
if (-not $Dominio -or $Dominio -notlike "*.ts.net") {
  Falla "No se pudo obtener el nombre *.ts.net de este equipo. Active MagicDNS en https://login.tailscale.com/admin/dns o use -Dominio."
}
Ok "Tailscale conectado: $Dominio"

if (-not (Test-Path (Join-Path $App ".env.local"))) {
  Falla "Falta $App\.env.local. Copie .env.example a .env.local y complete los datos de SQL Server."
}
Ok ".env.local encontrado"

# --- 2. Compilar la app ------------------------------------------------------
if ($Release) { Paso "Version $((Get-Content (Join-Path $App 'VERSION') -ErrorAction SilentlyContinue)) (ya compilada)" }
else { Paso "Instalando dependencias y compilando (puede tardar unos minutos)" }
Push-Location $App
try {
  if (-not $Release) {
    & npm ci --no-audit --no-fund
    if ($LASTEXITCODE -ne 0) { Falla "npm ci fallo" }
  }
  Write-Host "    Probando la conexion a SQL Server..."
  & $node scripts\probar-conexion.mjs
  if ($LASTEXITCODE -ne 0) { Falla "La app no puede conectarse a la base de datos (vea el mensaje anterior)." }
  if (-not $Release) {
    & npm run build
    if ($LASTEXITCODE -ne 0) { Falla "La compilacion fallo" }
  }
} finally { Pop-Location }
Ok $(if ($Release) { "Conexion a SQL Server correcta" } else { "App compilada" })

# --- 3. Caddy y Caddyfile ----------------------------------------------------
Paso "Preparando Caddy"
$logs = Join-Path $CarpetaServicio "logs"
New-Item -ItemType Directory -Force -Path $CarpetaServicio, $logs | Out-Null
$caddy = Join-Path $CarpetaServicio "caddy.exe"
if (-not (Test-Path $caddy)) {
  Write-Host "    Descargando Caddy..."
  Invoke-WebRequest "https://caddyserver.com/api/download?os=windows&arch=amd64" -OutFile $caddy -UseBasicParsing
}
Ok "Caddy $((& $caddy version).Split(' ')[0])"

$caddyfile = Join-Path $CarpetaServicio "Caddyfile"
(Get-Content (Join-Path $PSScriptRoot "Caddyfile.plantilla") -Raw) `
  -replace "__DOMINIO__", $Dominio -replace "__PUERTO__", $Puerto -replace "__LOGS__", $logs.Replace("\", "/") |
  Set-Content -Path $caddyfile -Encoding ascii
& $caddy validate --config $caddyfile --adapter caddyfile 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) { & $caddy validate --config $caddyfile --adapter caddyfile; Falla "El Caddyfile no es valido" }
Ok "Caddyfile: $caddyfile"

# --- 4. App como tarea al iniciar Windows ------------------------------------
Paso "Registrando la app ($NombreTarea)"
$iniciar = Join-Path $CarpetaServicio "iniciar-app.cmd"
# Release: servidor autocontenido (server.js). Repositorio: "next start".
$comando = if ($Release) { "`"$node`" `"$App\server.js`"" } else { "`"$node`" `"$App\node_modules\next\dist\bin\next`" start -H 127.0.0.1 -p $Puerto" }
@"
@echo off
rem Generado por deploy\instalar.ps1. Inicia InventX Movil solo en 127.0.0.1 (Caddy publica el HTTPS).
cd /d "$App"
set NODE_ENV=production
set HOSTNAME=127.0.0.1
set PORT=$Puerto
$comando >> "$logs\app.log" 2>&1
"@ | Set-Content -Path $iniciar -Encoding ascii

Stop-ScheduledTask -TaskName $NombreTarea -ErrorAction SilentlyContinue
$accion = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$iniciar`""
$disparador = New-ScheduledTaskTrigger -AtStartup
$ajustes = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
  -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$usuario = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName $NombreTarea -Action $accion -Trigger $disparador -Settings $ajustes -Principal $usuario -Force | Out-Null
# Detiene una instancia anterior que siga ocupando el puerto (actualizacion).
Get-NetTCPConnection -LocalPort $Puerto -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
Start-ScheduledTask -TaskName $NombreTarea
Ok "La app arranca con Windows y se reinicia si se detiene"

# --- 5. Caddy como servicio --------------------------------------------------
Paso "Registrando Caddy como servicio ($NombreServicio)"
if (Get-Service $NombreServicio -ErrorAction SilentlyContinue) {
  Stop-Service $NombreServicio -Force -ErrorAction SilentlyContinue
  & sc.exe delete $NombreServicio | Out-Null
  Start-Sleep -Seconds 2
}
& sc.exe create $NombreServicio start= auto DisplayName= "InventX Movil - Caddy HTTPS" binPath= "`"$caddy`" run --config `"$caddyfile`" --adapter caddyfile" | Out-Null
& sc.exe failure $NombreServicio reset= 86400 actions= restart/5000/restart/5000/restart/30000 | Out-Null
Start-Service $NombreServicio
Ok "Caddy en ejecucion"

# --- 6. Comprobacion ---------------------------------------------------------
Paso "Comprobando https://$Dominio"
$listo = $false
for ($i = 0; $i -lt 30 -and -not $listo; $i++) {
  Start-Sleep -Seconds 2
  try {
    $r = Invoke-WebRequest "https://$Dominio/login" -UseBasicParsing -TimeoutSec 10
    $listo = $r.StatusCode -eq 200
  } catch {}
}
if (-not $listo) {
  Write-Host "    No respondio todavia. Revise:" -ForegroundColor Yellow
  Write-Host "    - Que 'HTTPS Certificates' este activado en https://login.tailscale.com/admin/dns"
  Write-Host "    - Los registros en $logs (app.log y caddy.log)"
  exit 1
}
Ok "Funcionando"

# --- 7. Direccion y QR ---------------------------------------------------------
# Se guarda en la base (URL_APP_WEB) para que InventX escritorio muestre el QR en Ajustes > Puntos web.
Write-Host "`nInventX Ventas quedo publicado. Escanee el QR con el celular (Tailscale conectado) o abra la direccion en una PC:" -ForegroundColor Green
Push-Location $App
try { & $node scripts\registrar-url.mjs "https://$Dominio" } finally { Pop-Location }
Write-Host "En el celular o la PC, use 'Instalar app' para tenerla como aplicacion.`n"
