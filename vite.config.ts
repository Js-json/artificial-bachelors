import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

function vercelApiPlugin(): Plugin {
  return {
    name: 'vercel-api-plugin',
    configureServer(server) {
      const env = loadEnv('development', process.cwd(), '')
      Object.assign(process.env, env)

      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/explain' || req.url?.startsWith('/api/explain?')) {
          let bodyStr = ''
          req.on('data', (chunk) => {
            bodyStr += chunk
          })
          req.on('end', async () => {
            try {
              (req as any).body = bodyStr ? JSON.parse(bodyStr) : {}
            } catch {
              (req as any).body = {}
            }

            const resMock = {
              status(code: number) {
                res.statusCode = code
                return resMock
              },
              json(data: any) {
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify(data))
                return resMock
              }
            }

            try {
              const module = await server.ssrLoadModule('/api/explain.ts')
              const handler = module.default
              await handler(req, resMock)
            } catch (err: any) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err.message }))
            }
          })
          return
        }
        next()
      })
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), vercelApiPlugin()],
})
