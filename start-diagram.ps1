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
Write-Host "Ouverture de $url"
Start-Process $url | Out-Null

if ($python.Name -eq "py") {
  & py -m http.server $Port
} else {
  & python -m http.server $Port
}
