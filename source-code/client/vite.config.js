import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // No proxy setup - connecting directly to the server
  },
  define: {
    // Define any global constants here if needed
  }
})
