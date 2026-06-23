import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    strictPort: true,
    // INTERCEPT CORS BY ROUTING VIA LOCAL VITE SERVER PROXY
    proxy: {
      '/evaluation-service': {
        target: 'http://4.224.186.213',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})