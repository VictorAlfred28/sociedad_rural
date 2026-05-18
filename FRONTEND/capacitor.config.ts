import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ar.agentech.sociedadrural',
  appName: 'Sociedad Rural',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // iOS también usa https para App Transport Security (ATS)
    iosScheme: 'https',
    // En producción NO usar livereload — solo para desarrollo local con Mac
    // url: 'http://192.168.x.x:3000', // solo para desarrollo iOS con Xcode
    cleartext: false,
  },
  android: {
    // Hardware acceleration: mejora el renderizado de imágenes en Android WebView
    // Evita imágenes lavadas, parpadeos y renders incompletos
    allowMixedContent: false,
    captureInput: false,
    webContentsDebuggingEnabled: false,
    loggingBehavior: 'none',
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#245b31',
      showSpinner: true,
      androidSpinnerStyle: 'large',
      iosSpinnerStyle: 'large',
      spinnerColor: '#ffffff',
      splashFullScreen: true,
      splashImmersive: true,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
};

export default config;

