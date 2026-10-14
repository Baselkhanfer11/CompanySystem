import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Always 5173 (SpaceShare uses 5174), so the browser never mixes up the two
    // apps' saved passwords and sign-ins. strictPort: fail instead of moving.
    port: 5173,
    strictPort: true,
    // Forward any request starting with /api to the .NET backend.
    // This means the React code can just call "/api/employees" with no CORS issues.
    proxy: {
      '/api': {
        target: 'http://localhost:5022',
        changeOrigin: true,
      },
    },
  },
})
