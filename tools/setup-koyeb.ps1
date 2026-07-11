# Koyeb CLI indir (Windows)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$Bin = Join-Path $Root "tools\bin"
$Exe = Join-Path $Bin "koyeb.exe"

New-Item -ItemType Directory -Force -Path $Bin | Out-Null

if (Test-Path $Exe) {
    Write-Host "Koyeb CLI zaten var: $Exe"
    & $Exe version
    exit 0
}

Write-Host "Koyeb CLI indiriliyor..."
$rel = (Invoke-RestMethod "https://api.github.com/repos/koyeb/koyeb-cli/releases/latest").assets |
    Where-Object { $_.name -like "*windows_amd64*" } | Select-Object -First 1
$zip = Join-Path $Bin "koyeb.zip"
Invoke-WebRequest -Uri $rel.browser_download_url -OutFile $zip
Expand-Archive -Force $zip -DestinationPath $Bin
Remove-Item $zip -ErrorAction SilentlyContinue
Write-Host "Kuruldu. Sonraki: tools\bin\koyeb.exe login"
