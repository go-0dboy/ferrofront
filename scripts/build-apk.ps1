# ФЕРРОФРОНТ — локальная сборка debug-APK (Windows PowerShell).
# Требования: Node >= 22, JDK 17, Android SDK (ANDROID_HOME), лицензии приняты.
# Использование: powershell -ExecutionPolicy Bypass -File scripts/build-apk.ps1
$ErrorActionPreference = "Stop"
Set-Location (Split-Path $PSScriptRoot)

$nodeMajor = [int]((node -p "process.versions.node.split('.')[0]"))
if ($nodeMajor -lt 22) { Write-Error "Нужен Node >= 22 (сейчас $(node -v)). См. .nvmrc."; exit 1 }
Write-Host "Node $(node -v) — OK"

if (-not ($env:ANDROID_HOME -or $env:ANDROID_SDK_ROOT)) {
  Write-Error "ANDROID_HOME не задан. Установите Android Studio / SDK и укажите путь."
  exit 1
}

Write-Host "-> Зависимости..."
npm ci --no-audit --no-fund
node -e "require.resolve('@capacitor/cli')" 2>$null
if ($LASTEXITCODE -ne 0) { npm i --no-save @capacitor/cli @capacitor/android }
node -e "require.resolve('@capacitor/core')" 2>$null
if ($LASTEXITCODE -ne 0) { npm i --no-save @capacitor/core }

Write-Host "-> Веб-сборка..."
npm run build

Write-Host "-> Android-проект (add/sync)..."
if (Test-Path android) { npx cap sync android } else { npx cap add android; npx cap sync android }

Write-Host "-> Gradle: assembleDebug..."
Push-Location android
if (Test-Path .\gradlew.bat) { .\gradlew.bat assembleDebug } else { gradle assembleDebug }
Pop-Location

New-Item -ItemType Directory -Force -Path dist-apk | Out-Null
Copy-Item android\app\build\outputs\apk\debug\app-debug.apk dist-apk\ferrofront-debug.apk -Force
Write-Host ""
Write-Host "Готово: dist-apk\ferrofront-debug.apk"
Write-Host "Установить на телефон: adb install -r dist-apk\ferrofront-debug.apk"
