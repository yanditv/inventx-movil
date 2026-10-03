<#
.SYNOPSIS
  Instala o actualiza InventX Movil desde la ultima Release de GitHub.
  No necesita Git, Node.js ni compilar: el paquete ya viene listo y trae su propio Node.js.

.DESCRIPTION
  Ejecutar en PowerShell como administrador (sirve para instalar y para actualizar):

    irm https://github.com/yanditv/inventx-movil/releases/latest/download/instalar-web.ps1 | iex

  1. Descarga inventx-movil-windows.zip de la ultima Release.
  2. Detiene la app si esta corriendo y reemplaza la carpeta, conservando .env.local.
  3. La primera vez crea .env.local (con SESSION_SECRET ya generado) y lo abre para completar SQL Server.
  4. Ejecuta deploy\instalar.ps1 (prueba la base, registra la app y Caddy, comprueba el HTTPS).

  Carpeta: C:\InventX\inventx-movil (cambiar con $env:INVENTX_DESTINO antes de ejecutar).
#>
& {
  $ErrorActionPreference = "Stop"
  $Destino = if ($env:INVENTX_DESTINO) { $env:INVENTX_DESTINO } else { "C:\InventX\inventx-movil" }
  $Url = "https://github.com/yanditv/inventx-movil/releases/latest/download/inventx-movil-windows.zip"

  $admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator)
  if (-not $admin) {
    Write-Host "Abra PowerShell como administrador (clic derecho > Ejecutar como administrador) y vuelva a pegar el comando." -ForegroundColor Red
    return
  }

  # --- 1. Descargar -------------------------------------------------------------
  Write-Host "`n==> Descargando la ultima version de InventX Movil" -ForegroundColor Cyan
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $zip = Join-Path $env:TEMP "inventx-movil-windows.zip"
  $temporal = Join-Path $env:TEMP "inventx-movil-nuevo"
  $ProgressPreference = "SilentlyContinue" # sin la barra de progreso la descarga es mucho mas rapida
  Invoke-WebRequest $Url -OutFile $zip -UseBasicParsing
  Remove-Item $temporal -Recurse -Force -ErrorAction SilentlyContinue
  Expand-Archive $zip -DestinationPath $temporal -Force
  $nuevo = Join-Path $temporal "inventx-movil"
  # Quita la marca "descargado de internet" para que Windows no bloquee node.exe ni los scripts.
  Get-ChildItem $nuevo -Recurse -File | Unblock-File
  Write-Host "    Version $(Get-Content (Join-Path $nuevo 'VERSION'))" -ForegroundColor Green

  # --- 2. Reemplazar la instalacion conservando la configuracion -------------------
  Write-Host "`n==> Instalando en $Destino" -ForegroundColor Cyan
  Stop-ScheduledTask -TaskName "InventX Movil" -ErrorAction SilentlyContinue
  Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "$Destino\*" } | Stop-Process -Force
  Start-Sleep -Seconds 1
  $env_local = Join-Path $Destino ".env.local"
  $config = if (Test-Path $env_local) { Get-Content $env_local -Raw } else { $null }
  if (Test-Path $Destino) { Remove-Item $Destino -Recurse -Force }
  New-Item -ItemType Directory -Force -Path (Split-Path $Destino) | Out-Null
  Move-Item $nuevo $Destino
  Remove-Item $temporal, $zip -Recurse -Force -ErrorAction SilentlyContinue

  # --- 3. Configuracion (solo la primera vez) --------------------------------------
  if ($config) {
    [IO.File]::WriteAllText($env_local, $config) # UTF-8 sin BOM
    Write-Host "    Configuracion .env.local conservada" -ForegroundColor Green
  } else {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secreto = -join ($bytes | ForEach-Object { $_.ToString("x2") })
    $plantilla = (Get-Content (Join-Path $Destino ".env.example") -Raw) -replace "(?m)^SESSION_SECRET=.*$", "SESSION_SECRET=$secreto"
    [IO.File]::WriteAllText($env_local, $plantilla) # UTF-8 sin BOM
    Write-Host "`nPrimera instalacion: complete los datos de SQL Server (DB_SERVER, DB_USER, DB_PASSWORD...)," -ForegroundColor Yellow
    Write-Host "guarde y cierre el Bloc de notas para continuar." -ForegroundColor Yellow
    Start-Process notepad.exe $env_local -Wait
  }

  # --- 4. Registrar la app, Caddy y comprobar ----------------------------------------
  & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $Destino "deploy\instalar.ps1")
}
