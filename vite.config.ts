import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiPort = env.PORT || '5174'
  const target = `http://127.0.0.1:${apiPort}`

  return {
    plugins: [react()],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    server: {
      port: 5173,
      // Everything under /api goes to the local Express server, so the browser
      // only ever talks to one origin and there is no CORS to configure.
      proxy: {
        '/api': {
          target,
          changeOrigin: false,
          ws: false,
          configure(proxy) {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Connection', 'close')
            })
            proxy.on('error', (error, _request, response) => {
              console.error(`[vite proxy] ${target}: ${error.message}`)
              if (
                'writeHead' in response && typeof response.writeHead === 'function' &&
                'end' in response && typeof response.end === 'function' &&
                'writableEnded' in response && !response.writableEnded
              ) {
                response.writeHead(503, { 'Content-Type': 'application/json' })
                response.end(JSON.stringify({ error: { message: error.message, code: 'PROXY' } }))
              }
            })
          },
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            data: ['@tanstack/react-query'],
          },
        },
      },
    },
  }
})
