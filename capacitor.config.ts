/**
 * ФЕРРОФРОНТ — конфигурация Capacitor (обёртка веб-игры в нативный Android-контейнер).
 *
 * Типизация появится после установки пакетов:
 *   npm i @capacitor/core && npm i -D @capacitor/cli @capacitor/android
 * Скрипты scripts/build-apk.* и CI устанавливают их автоматически,
 * если их ещё нет в package.json.
 */
const config = {
  /** Уникальный идентификатор приложения (замените домен перед публикацией в Google Play). */
  appId: 'com.ferrofront.app',
  appName: 'Феррофронт',
  /** Каталог веб-сборки (результат `npm run build`). */
  webDir: 'dist',
  backgroundColor: '#0a0f16',
  server: {
    /** Контент отдаётся по https-схеме внутри WebView — нужно для GPS и датчиков. */
    androidScheme: 'https',
  },
  android: {
    /** Разрешить отладку WebView через chrome://inspect в debug-сборках удобно, но выключаем для чистоты. */
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#0a0f16',
      spinnerStyle: 'small',
      spinnerColor: '#35e0c8',
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#0a0f16',
    },
  },
};

export default config;
