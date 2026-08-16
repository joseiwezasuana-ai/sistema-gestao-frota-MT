import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    base: '/',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: path.resolve(__dirname, 'src'),
        filename: 'sw.ts',
        registerType: 'autoUpdate',
        includeAssets: ['logo.svg', 'icon-192.png', 'icon-512.png'],
        manifest: {
          name: 'SUPER Taxi Control',
          short_name: 'TaxiControl',
          description: 'Sistema de Controlo de Frota - LUENA MOXICO',
          theme_color: '#1e293b',
          icons: [
            {
              src: 'icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'logo.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any maskable'
            }
          ]
        },
        injectManifest: {
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        }
      })
    ],
    build: {
      outDir: 'dist',
      target: 'es2022',
      commonjsOptions: {
        include: [/firebase/, /node_modules/]
      },
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Firebase mantido fora dos manualChunks para evitar perda de protótipos/métodos estáticos
            if (id.includes('node_modules/leaflet') || id.includes('node_modules/react-leaflet')) {
              return 'vendor-map';
            }
            if (id.includes('node_modules/recharts')) {
              return 'vendor-recharts';
            }
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules/motion')) {
              return 'vendor-ui';
            }
          }
        }
      }
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'lucide-react',
        'motion/react',
        'recharts',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'leaflet',
        'react-leaflet',
        'swr',
        'date-fns',
        'jspdf',
        'html2canvas',
        'dompurify',
      ],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      hmr: false,
      ws: false,
    },
  };
});