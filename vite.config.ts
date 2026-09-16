import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'

function vercelApiDevPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'vite-plugin-vercel-api',
    configureServer(server) {
      Object.assign(process.env, env)

      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/explain' || req.url?.startsWith('/api/explain?')) {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk
          })
          req.on('end', async () => {
            try {
              (req as any).body = body ? JSON.parse(body) : {}
            } catch {
              (req as any).body = {}
            }

            (res as any).status = (statusCode: number) => {
              res.statusCode = statusCode
              return res
            }
            (res as any).json = (data: any) => {
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify(data))
              return res
            }

            try {
              const module = await server.ssrLoadModule('/api/explain.ts')
              const handler = module.default
              await handler(req, res)
            } catch (err: any) {
              console.error('API middleware error:', err)
              if (!res.headersSent) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: err.message }))
              }
            }
          })
        } else {
          next()
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), vercelApiDevPlugin(env)],
  }
})

