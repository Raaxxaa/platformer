// The iPhone and Mac app (M16): Capacitor wraps the built game (`dist/`) in a native iOS app. Not for the App Store.
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.raaxxaa.rushblade',
  appName: 'RUSHBLADE',
  webDir: 'dist',
  backgroundColor: '#0d0b14',
  ios: { contentInset: 'never', backgroundColor: '#0d0b14', scrollEnabled: false },
  // Hides the status bar and lets the home indicator fade away while playing.
  plugins: { SystemBars: { hidden: true } },
};

export default config;
