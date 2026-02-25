param(
  [int]$Port = 8080
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  $python = Get-Command py -ErrorAction SilentlyContinue
}

if (-not $python) {
  Write-Error "Python introuvable. Installe Python puis relance ce script."
  exit 1
}

$url = "http://localhost:$Port/viewer/"
Write-Host "Lancement du serveur interactif sur $url"

if ($python.Name -eq "py") {
  & py .\start-diagram.py --port $Port
} else {
  & python .\start-diagram.py --port $Port
}
