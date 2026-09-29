import 'dotenv/config'
import express from 'express'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { api } from './routes.js'
import { pool } from './db.js'

const here = dirname(fileURLToPath(import.meta.url))
const distDir = join(here, '..', 'dist')
const port = Number(process.env.PORT) || 5174

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  process.exit(1)
}

const app = express()
app.use(express.json({ limit: '2mb' }))

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('select 1')
    const schemaResult = await pool.query("select to_regclass('public.settings') as t")
    const schema = schemaResult.rows[0].t ? 'ready' : 'missing'
    res.status(schema === 'ready' ? 200 : 503).json({ ok: schema === 'ready', database: 'up', schema })
  } catch (err) {
    res.status(503).json({ ok: false, database: 'down', schema: 'missing', message: err.message })
  }
})

app.use('/api', api)

// In production the same server hands out the built frontend, so there is one
// process, one port, and no CORS anywhere.
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(distDir, 'index.html')))
}

app.use((_req, res) => res.status(404).json({ error: { message: 'Not found' } }))

// Postgres raises a specific error for every rule the schema enforces. They are
// passed through with their code so the frontend can phrase them for a person.
app.use((err, _req, res, _next) => {
  const code = err.code
  const schemaUnavailable = ['42P01', '42883', '42704', '3D000'].includes(code)
  const status =
    schemaUnavailable ? 503 :
    code === '23505' ? 409 :
    code === '23503' ? 409 :
    code === '23514' ? 400 :
    code === 'P0001' ? 400 :
    code === '22P02' ? 400 :
    500
  if (status === 500) console.error(err)
  const message = schemaUnavailable
    ? 'Database schema is missing or out of date. Run: npm run db:setup'
    : err.message
  res.status(status).json({ error: { message, code, detail: err.detail } })
})

function startupErrorCode(error) {
  if (error?.code) return error.code
  if (error?.cause) return startupErrorCode(error.cause)
  if (Array.isArray(error?.errors)) {
    for (const nestedError of error.errors) {
      const code = startupErrorCode(nestedError)
      if (code) return code
    }
  }
  return undefined
}

async function start() {
  try {
    await pool.query('select 1')
    const schemaResult = await pool.query("select to_regclass('public.settings') as t")
    if (!schemaResult.rows[0].t) {
      console.error('Connected to PostgreSQL, but the Uzoni tables are not there. Run: npm run db:setup')
      await pool.end()
      process.exit(1)
    }
  } catch (error) {
    const code = startupErrorCode(error)
    const message = code === 'ECONNREFUSED'
      ? 'Cannot connect to PostgreSQL. Make sure PostgreSQL is running and DATABASE_URL uses the correct port.'
      : code === '3D000'
        ? 'The PostgreSQL database does not exist. Run: npm run db:setup'
        : code === '28P01'
          ? 'PostgreSQL rejected the password in DATABASE_URL. Check your .env credentials.'
          : `Could not verify the PostgreSQL database: ${error.message}`
    console.error(message)
    await pool.end()
    process.exit(1)
  }

  const server = app.listen(port, '127.0.0.1', () => {
    console.log(`Uzoni API listening on http://127.0.0.1:${port}`)
    if (existsSync(distDir)) console.log(`Serving the app from ${distDir}`)
  })
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000
  server.on('clientError', (error, socket) => {
    console.error(`HTTP client error: ${error.message}`)
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  })

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      server.close(() => pool.end().then(() => process.exit(0)))
    })
  }
}

await start()
