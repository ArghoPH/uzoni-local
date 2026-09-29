#!/usr/bin/env node
/**
 * Creates the database if it is missing, then applies every file in db/ in
 * order. Safe to run again: the SQL is written to be idempotent.
 */
import 'dotenv/config'
import pg from 'pg'
import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const dbDir = join(here, '..', 'db')

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env first.')
  process.exit(1)
}

const parsed = new URL(url)
const dbName = decodeURIComponent(parsed.pathname.slice(1))
if (!dbName) {
  console.error(`DATABASE_URL has no database name: ${url}`)
  process.exit(1)
}

// Connect to the maintenance database first so the target can be created.
const adminUrl = new URL(url)
adminUrl.pathname = '/postgres'

const admin = new pg.Client({ connectionString: adminUrl.toString() })
await admin.connect()
const exists = await admin.query('select 1 from pg_database where datname = $1', [dbName])
if (exists.rowCount === 0) {
  // The name cannot be parameterised in CREATE DATABASE, so it is quoted.
  await admin.query(`create database "${dbName.replace(/"/g, '""')}"`)
  console.log(`created database ${dbName}`)
} else {
  console.log(`database ${dbName} already exists`)
}
await admin.end()

const client = new pg.Client({ connectionString: url })
await client.connect()

const files = (await readdir(dbDir)).filter((f) => f.endsWith('.sql')).sort()
for (const file of files) {
  const sql = await readFile(join(dbDir, file), 'utf8')
  process.stdout.write(`applying ${file} ... `)
  try {
    await client.query(sql)
    console.log('ok')
  } catch (err) {
    console.log('failed')
    console.error(`\n${file}: ${err.message}`)
    await client.end()
    process.exit(1)
  }
}

const { rows } = await client.query(
  'select (select count(*) from currencies) as currencies, (select count(*) from categories) as categories',
)
console.log(`\nReady — ${rows[0].currencies} currencies, ${rows[0].categories} categories.`)
await client.end()
