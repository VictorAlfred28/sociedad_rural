import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.agentech.sociedadrural',
  appName: 'Sociedad Rural',
  webDir: 'dist',
  // En desarrollo local puedes comentar 'server' y usar el build del 'dist'.
  // En producción, la app empaqueta el dist y consume el backend por VITE_API_URL.
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#245b31',
      showSpinner: true,
      androidSpinnerStyle: 'large',
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
