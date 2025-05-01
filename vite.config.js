import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'SAMEORIGIN',
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com https://*.firebaseapp.com;
        style-src 'self' 'unsafe-inline' https://api.mapbox.com https://fonts.googleapis.com;
        img-src 'self' data: https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com;
        font-src 'self' data: https://fonts.gstatic.com https://fonts.googleapis.com https://use.typekit.net;
        connect-src 'self' 
          http://localhost:5000 
          https://*.firebaseio.com 
          https://*.googleapis.com 
          https://*.firebaseapp.com 
          https://identitytoolkit.googleapis.com 
          https://firestore.googleapis.com 
          https://api.mapbox.com 
          https://events.mapbox.com 
          https://api.postcodes.io
          http://192.168.1.162:8080;
        frame-src 'self' https://api.mapbox.com https://*.firebaseio.com https://*.googleapis.com;
        worker-src 'self' blob:;
        manifest-src 'self';
        object-src 'none';
        base-uri 'self';
        form-action 'self';
        frame-ancestors 'self';
        upgrade-insecure-requests;
      `.replace(/\s+/g, ' ').trim()
    }
  }
}) 