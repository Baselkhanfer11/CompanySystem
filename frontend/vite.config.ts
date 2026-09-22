import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
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
