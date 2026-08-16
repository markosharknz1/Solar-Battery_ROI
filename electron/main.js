import { app, BrowserWindow } from 'electron'
import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const distDir = path.join(__dirname, '..', 'dist')

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.csv': 'text/csv',
  '.ico': 'image/x-icon',
}

// The port MUST be stable across launches: localStorage (tariff plans, battery quotes, VPP
// programs, the keep-data meter store) is scoped to the origin INCLUDING the port, so a random
// port (listen(0)) silently wiped everything on every app restart. Try a fixed ladder so a
// one-off conflict still lands on the same second choice next time.
const PORT_LADDER = [8317, 8318, 8319, 8320]

/**
 * Minimal static file server with SPA fallback (any unmatched path serves index.html), so the
 * app's BrowserRouter works exactly as it does under `vite preview` - without this, deep routes
 * like /battery would 404 when loaded directly instead of falling back to the client router.
 */
function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        let filePath = path.join(distDir, urlPath)

        let fileStat = await stat(filePath).catch(() => null)
        if (!fileStat || fileStat.isDirectory()) {
          filePath = path.join(distDir, 'index.html')
        }

        const ext = path.extname(filePath)
        const body = await readFile(filePath)
        res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] ?? 'application/octet-stream' })
        res.end(body)
      } catch (err) {
        res.writeHead(500)
        res.end(String(err))
      }
    })
    server.on('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

async function startServerOnLadder() {
  for (const port of PORT_LADDER) {
    try {
      return await startServer(port)
    } catch (err) {
      if (err?.code !== 'EADDRINUSE') throw err
    }
  }
  throw new Error(`All ports in ${PORT_LADDER.join(', ')} are in use`)
}

async function createWindow() {
  const server = await startServerOnLadder()
  const { port } = server.address()

  const win = new BrowserWindow({
    width: 1280,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.loadURL(`http://127.0.0.1:${port}/`)

  win.on('closed', () => server.close())
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  app.quit()
})
