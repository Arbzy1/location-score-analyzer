import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '')
  
  // The backend URL will be the VITE_API_URL from .env files
  // or default to the localhost for development
  const backendUrl = env.VITE_API_URL || 'http://localhost:5000'
  console.log(`Using backend URL: ${backendUrl} in ${mode} mode`)
  
  return {
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
          target: backendUrl,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false,
        ws: true,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
      }
      }
    },
    define: {
      // Pass environment variables to the client code
      'process.env.VITE_API_URL': JSON.stringify(backendUrl)
    }
  }
})
