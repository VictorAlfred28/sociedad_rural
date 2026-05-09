import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentech.sociedadrural',
  appName: 'Sociedad Rural',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    // iOS también usa https para App Transport Security (ATS)
    iosScheme: 'https',
    // En producción NO usar livereload — solo para desarrollo local con Mac
    // url: 'http://192.168.x.x:3000', // solo para desarrollo iOS con Xcode
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

