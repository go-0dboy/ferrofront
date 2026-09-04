#!/usr/bin/env node
/**
 * ФЕРРОФРОНТ — идемпотентная инъекция signing-конфига в android/app/build.gradle
 * для release-сборки. Читает параметры из окружения:
 *   FERRO_KEYSTORE, FERRO_STORE_PASSWORD, FERRO_KEY_ALIAS, FERRO_KEY_PASSWORD
 * Используется в CI (см. .github/workflows/apk.yml) и может вызываться локально.
 */
const fs = require('fs');
const path = require('path');

const gradlePath = path.resolve(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(gradlePath)) {
  console.error('android/app/build.gradle не найден. Сначала выполните: npx cap add android && npx cap sync android');
  process.exit(1);
}

let src = fs.readFileSync(gradlePath, 'utf8');

if (src.includes('FERRO_KEYSTORE')) {
  console.log('Signing-конфиг уже присутствует — пропускаем.');
  process.exit(0);
}

const signingBlock = `    signingConfigs {
        release {
            storeFile file(System.getenv("FERRO_KEYSTORE") ?: "ferrofront.keystore")
            storePassword System.getenv("FERRO_STORE_PASSWORD") ?: ""
            keyAlias System.getenv("FERRO_KEY_ALIAS") ?: ""
            keyPassword System.getenv("FERRO_KEY_PASSWORD") ?: ""
        }
    }
`;

// 1) вставляем signingConfigs внутрь android { ... }
if (!/android\s*\{/.test(src)) {
  console.error('Не найден блок android { } в build.gradle');
  process.exit(1);
}
src = src.replace(/android\s*\{/, `android {\n${signingBlock}`);

// 2) привязываем конфиг к release-варианту сборки
if (/buildTypes\s*\{[\s\S]*?release\s*\{/.test(src)) {
  src = src.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
} else {
  console.warn('Блок buildTypes.release не найден — signingConfigs добавлен, привяжите вручную.');
}

fs.writeFileSync(gradlePath, src);
console.log('Signing-конфиг применён к android/app/build.gradle');
