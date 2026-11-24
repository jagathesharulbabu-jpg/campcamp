# Auto-detect Python and permanently add it to Windows User PATH
Write-Host "Searching for Python installations on your computer..." -ForegroundColor Cyan

$searchLocations = @(
    "$env:LOCALAPPDATA\Programs\Python",
    "$env:APPDATA\Local\Programs\Python",
    "C:\Program Files\Python*",
    "C:\Program Files (x86)\Python*",
    "C:\Python*",
    "$env:USERPROFILE\anaconda3",
    "$env:USERPROFILE\miniconda3",
    "$env:LOCALAPPDATA\Microsoft\WindowsApps"
)

$foundPythons = @()

foreach ($loc in $searchLocations) {
    if (Test-Path (Split-Path $loc -Parent)) {
        $pythons = Get-ChildItem -Path $loc -Filter "python.exe" -Recurse -Depth 3 -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notmatch "WindowsApps" -or $_.Length -gt 0 }
        if ($pythons) {
            $foundPythons += $pythons
        }
    }
}

if ($foundPythons.Count -eq 0) {
    Write-Host "`nCould not automatically find python.exe in standard folders." -ForegroundColor Yellow
    Write-Host "Please locate python.exe manually or reinstall Python from python.org with 'Add to PATH' checked." -ForegroundColor Yellow
    exit
}

$pyExe = $foundPythons[0].FullName
$pyDir = Split-Path $pyExe -Parent
$pyScriptsDir = Join-Path $pyDir "Scripts"

Write-Host "`n✓ Found Python at: $pyExe" -ForegroundColor Green
Write-Host "✓ Scripts folder: $pyScriptsDir" -ForegroundColor Green

# 1. Update Current Session PATH
$env:Path = "$pyDir;$pyScriptsDir;$env:Path"

# 2. Update User PATH permanently in Windows Registry
$userPath = [Environment]::GetEnvironmentVariable("Path", [EnvironmentVariableTarget]::User)
$newPaths = @()

if ($userPath -notmatch [regex]::Escape($pyDir)) {
    $newPaths += $pyDir
}
if ($userPath -notmatch [regex]::Escape($pyScriptsDir)) {
    $newPaths += $pyScriptsDir
}

if ($newPaths.Count -gt 0) {
    $updatedUserPath = ($newPaths + $userPath) -join ";"
    [Environment]::SetEnvironmentVariable("Path", $updatedUserPath, [EnvironmentVariableTarget]::User)
    Write-Host "✓ Added Python permanently to Windows User Environment PATH!" -ForegroundColor Green
} else {
    Write-Host "✓ Python was already in your User Environment variables." -ForegroundColor Green
}

Write-Host "`nTesting Python in current session:" -ForegroundColor Cyan
& python --version
& pip --version

Write-Host "`nDone! You can now run your Django commands." -ForegroundColor Green
