import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SCRIPT_PATH = fileURLToPath(import.meta.url)
const SCRIPT_DIR = dirname(SCRIPT_PATH)
const ROOT_DIR = resolve(SCRIPT_DIR, '..')

function decodeQuotedValue(value, quote) {
  const inner = value.slice(1, -1)

  if (quote !== '"') {
    return inner
  }

  return inner
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function parseEnvLine(line) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
  if (!match) {
    return null
  }

  const [, key, rawValue] = match
  let value = rawValue.trim()

  if (!value) {
    return { key, value: '' }
  }

  const quote = value[0]
  const isQuoted = (quote === '"' || quote === "'") && value.endsWith(quote)

  if (isQuoted && value.length >= 2) {
    value = decodeQuotedValue(value, quote)
  } else {
    value = value.replace(/\s+#.*$/, '').trim()
  }

  return { key, value }
}

export function loadEnvFile(envPath = resolve(ROOT_DIR, '.env')) {
  if (!existsSync(envPath)) {
    return false
  }

  const contents = readFileSync(envPath, 'utf8')

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const parsed = parseEnvLine(line)
    if (!parsed) {
      continue
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value
    }
  }

  return true
}

export async function startServer() {
  loadEnvFile()
  const serverEntry = pathToFileURL(resolve(ROOT_DIR, '.output/server/index.mjs')).href
  await import(serverEntry)
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  await startServer()
}
