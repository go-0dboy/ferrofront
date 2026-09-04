#!/usr/bin/env bash
# ФЕРРОФРОНТ — локальная сборка debug-APK.
# Требования: Node >= 22, JDK 17, Android SDK (ANDROID_HOME), лицензии приняты.
# Использование: bash scripts/build-apk.sh
set -euo pipefail
cd "$(dirname "$0")/.."

NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "✗ Нужен Node >= 22 (сейчас $(node -v)). Переключитесь: nvm use  (файл .nvmrc приложен)." >&2
  exit 1
fi
echo "✓ Node $(node -v)"

if [ -z "${ANDROID_HOME:-}" ] && [ -z "${ANDROID_SDK_ROOT:-}" ]; then
  echo "✗ ANDROID_HOME не задан. Установите Android Studio / SDK и укажите путь." >&2
  exit 1
fi

echo "→ Зависимости (Capacitor подставится сам, если его нет)…"
npm ci --no-audit --no-fund 2>/dev/null || npm install --no-audit --no-fund
node -e "require.resolve('@capacitor/cli')" 2>/dev/null || npm i --no-save @capacitor/cli @capacitor/android
node -e "require.resolve('@capacitor/core')" 2>/dev/null || npm i --no-save @capacitor/core

echo "→ Веб-сборка…"
npm run build

echo "→ Android-проект (add/sync)…"
if [ -d android ]; then
  npx cap sync android
else
  npx cap add android
  npx cap sync android
fi

echo "→ Gradle: assembleDebug…"
( cd android && ./gradlew assembleDebug )

mkdir -p dist-apk
cp android/app/build/outputs/apk/debug/app-debug.apk dist-apk/ferrofront-debug.apk
echo ""
echo "✓ Готово: dist-apk/ferrofront-debug.apk"
echo "  Установить на телефон: adb install -r dist-apk/ferrofront-debug.apk"
