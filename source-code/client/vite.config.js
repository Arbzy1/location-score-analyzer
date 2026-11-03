import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During `npm run dev`, send API calls to `wrangler dev` in ../worker
    proxy: {
      '/api': 'http://localhost:8787'
    }
  }
})
