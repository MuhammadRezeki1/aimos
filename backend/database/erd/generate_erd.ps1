# AIMOS ERD Generator (Windows PowerShell)
# Jalankan dari folder ini:
#   cd backend\database\erd
#   .\generate_erd.ps1
#
# Opsi:
#   .\generate_erd.ps1 -Format png
#   .\generate_erd.ps1 -Format svg
#   .\generate_erd.ps1 -Format pdf
#   .\generate_erd.ps1 -OpenDbDiagram

param(
    [ValidateSet("png", "svg", "pdf")]
    [string]$Format = "png",
    [switch]$OpenDbDiagram,
    [switch]$OpenMermaidLive
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$DbmlFile = Join-Path $ScriptDir "aimos.dbml"
$MmdFile = Join-Path $ScriptDir "aimos.mmd"
$OutFile = Join-Path $ScriptDir "aimos-erd.$Format"

Write-Host ""
Write-Host "=== AIMOS ERD Generator ===" -ForegroundColor Cyan
Write-Host ""

if ($OpenDbDiagram) {
    Write-Host "[DBML] Buka https://dbdiagram.io/d lalu import file:" -ForegroundColor Green
    Write-Host "       $DbmlFile" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "       Langkah: New Diagram -> Import -> paste isi aimos.dbml" -ForegroundColor Gray
    Start-Process "https://dbdiagram.io/d"
    exit 0
}

if ($OpenMermaidLive) {
    $encoded = [uri]::EscapeDataString((Get-Content $MmdFile -Raw))
    $url = "https://mermaid.live/edit#base64:" + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes((Get-Content $MmdFile -Raw)))
    Write-Host "[Mermaid] Membuka Mermaid Live Editor..." -ForegroundColor Green
    Start-Process $url
    exit 0
}

# Cek Node.js untuk mermaid-cli
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "[ERROR] Node.js tidak ditemukan." -ForegroundColor Red
    Write-Host ""
    Write-Host "Rekomendasi tanpa install:" -ForegroundColor Yellow
    Write-Host "  1. DBML (TERBAIK):  .\generate_erd.ps1 -OpenDbDiagram" -ForegroundColor White
    Write-Host "  2. Mermaid online:  .\generate_erd.ps1 -OpenMermaidLive" -ForegroundColor White
    Write-Host ""
    Write-Host "Atau install Node.js dari https://nodejs.org lalu jalankan ulang script ini." -ForegroundColor Gray
    exit 1
}

Write-Host "[Mermaid CLI] Render $MmdFile -> $OutFile" -ForegroundColor Green
Push-Location $ScriptDir
try {
    npx --yes @mermaid-js/mermaid-cli -i "aimos.mmd" -o "aimos-erd.$Format" -b transparent 2>&1
    if (Test-Path $OutFile) {
        Write-Host ""
        Write-Host "[OK] ERD tersimpan: $OutFile" -ForegroundColor Green
        Invoke-Item $OutFile
    } else {
        Write-Host ""
        Write-Host "[WARN] Mermaid CLI gagal (biasanya butuh Chrome/Puppeteer)." -ForegroundColor Yellow
        Write-Host "       Coba install browser headless, lalu jalankan ulang:" -ForegroundColor Gray
        Write-Host "       npx puppeteer browsers install chrome-headless-shell" -ForegroundColor White
        Write-Host ""
        Write-Host "       Atau pakai DBML (tanpa install, direkomendasikan):" -ForegroundColor Cyan
        Write-Host "       .\generate_erd.ps1 -OpenDbDiagram" -ForegroundColor White
        exit 1
    }
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "Tips: Untuk ERD interaktif + export PDF, gunakan DBML:" -ForegroundColor Cyan
Write-Host "  .\generate_erd.ps1 -OpenDbDiagram" -ForegroundColor White
