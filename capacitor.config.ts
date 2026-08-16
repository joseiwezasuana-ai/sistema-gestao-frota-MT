import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.supertaxi.app',
  appName: 'SuperTáxi',
  webDir: 'dist',
  server: {
    url: 'https://jis-st.web.app',
    cleartext: true
  }
};

export default config;