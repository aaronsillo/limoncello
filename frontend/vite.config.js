import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Escucha en todas las interfaces de red (para acceder desde el celular)
    host: true,
    proxy: {
      // Las llamadas a /api se redirigen al backend de Express
      '/api': 'http://localhost:3000',
    },
  },
})
