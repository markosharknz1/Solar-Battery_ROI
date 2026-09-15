// Solar & Battery Advisor - no-install launcher. Run by the official signed
// node.exe (see "Solar & Battery Advisor.cmd"); serves the built app from
// dist\ on 127.0.0.1 and opens it in an Edge/Chrome "app window" (chromeless,
// its own taskbar entry). No executable of our own, no PowerShell, no WSH -
// nothing for SmartScreen or Smart App Control to object to.
//
// Data note: everything the app saves (tariff plans, battery quotes, VPP
// programs, settings) lives in the browser profile folder .edge-app-profile
// NEXT TO THIS FILE, keyed to the fixed port below. Keep that folder when
// upgrading (extract a new ZIP over this folder) and the data survives.
'use strict'

const fs = require('fs')
const path = require('path')
const http = require('http')
const { spawn } = require('child_process')

const APP_NAME = 'Solar & Battery Advisor'
// Fixed ladder, distinct from the Electron build's 8317-8320: browser storage
// is scoped to the origin INCLUDING the port, so this must stay stable.
const PORTS = [8321, 8322, 8323, 8324]
const HEALTH_PATH = '/__sba-health'
const HEALTH_BODY = 'solar-battery-advisor'

const distDir = path.join(__dirname, 'dist')
const profileDir = path.join(__dirname, '.edge-app-profile')

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

function findBrowser() {
  const pf = process.env['ProgramFiles'] || 'C:\\Program Files'
  const pf86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)'
  const local = process.env.LOCALAPPDATA || ''
  const candidates = [
    path.join(pf86, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(local, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    path.join(pf, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(pf86, 'Google', 'Chrome', 'Application', 'chrome.exe'),
    path.join(local, 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ]
  return candidates.find((p) => fs.existsSync(p)) || null
}

function openAppWindow(url) {
  const browser = findBrowser()
  if (!browser) {
    // No Edge/Chrome - fall back to the default browser (normal tab). The
    // server then stays up until this process is killed.
    spawn('cmd.exe', ['/c', 'start', '', url], { stdio: 'ignore', windowsHide: true })
    return null
  }
  // Deliberately NOT windowsHide: Chromium honours the hidden-start hint and
  // would open the app window invisible.
  return spawn(
    browser,
    [
      `--app=${url}`,
      `--user-data-dir=${profileDir}`,
      '--window-size=1280,900',
      '--no-first-run',
      '--no-default-browser-check',
      // A fresh profile on an MS-account PC otherwise pops a "syncing your
      // browsing data" prompt over the app on first launch.
      '--disable-sync',
      '--disable-features=msImplicitSignin,msSyncPromo',
    ],
    { stdio: 'ignore', windowsHide: false },
  )
}

function healthCheck(port) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: HEALTH_PATH, timeout: 700 }, (res) => {
      let body = ''
      res.on('data', (c) => (body += c))
      res.on('end', () => resolve(body.trim() === HEALTH_BODY))
    })
    req.on('error', () => resolve(false))
    req.on('timeout', () => {
      req.destroy()
      resolve(false)
    })
  })
}

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        if (urlPath === HEALTH_PATH) {
          res.writeHead(200, { 'Content-Type': 'text/plain' })
          res.end(HEALTH_BODY)
          return
        }
        let filePath = path.join(distDir, urlPath)
        let fileStat = await fs.promises.stat(filePath).catch(() => null)
        if (!fileStat || fileStat.isDirectory()) {
          filePath = path.join(distDir, 'index.html') // SPA fallback for BrowserRouter
        }
        const body = await fs.promises.readFile(filePath)
        res.writeHead(200, { 'Content-Type': MIME_TYPES[path.extname(filePath)] ?? 'application/octet-stream' })
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

async function main() {
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    // Headless process - surface the problem via a visible message box the
    // only dependency-free way Windows offers Node: a msg via cmd's `mshta`?
    // No scripts allowed. Simplest honest fallback: write a log and exit.
    fs.writeFileSync(
      path.join(__dirname, 'launcher-error.txt'),
      `${APP_NAME}: dist\\index.html not found next to launcher.cjs.\n` +
        'This file must be run from the extracted download folder (do not copy it out alone).\n',
    )
    process.exit(1)
  }

  // Already running (this app answers on a ladder port)? Just open a window on it.
  for (const port of PORTS) {
    if (await healthCheck(port)) {
      openAppWindow(`http://127.0.0.1:${port}/`)
      return // hand-off spawn exits immediately; the running copy owns the server
    }
  }

  let server = null
  let port = null
  for (const p of PORTS) {
    try {
      server = await startServer(p)
      port = p
      break
    } catch (err) {
      if (err?.code !== 'EADDRINUSE') throw err
    }
  }
  if (!server) {
    fs.writeFileSync(
      path.join(__dirname, 'launcher-error.txt'),
      `${APP_NAME}: ports ${PORTS.join(', ')} are all in use by other programs.\n`,
    )
    process.exit(1)
  }

  const child = openAppWindow(`http://127.0.0.1:${port}/`)
  if (child) {
    // Dedicated profile => the browser process lives while the app's last
    // window is open; when it exits, stop the server.
    child.on('exit', () => {
      server.close()
      process.exit(0)
    })
  }
}

main().catch((err) => {
  try {
    fs.writeFileSync(path.join(__dirname, 'launcher-error.txt'), `${APP_NAME} launcher failed:\n${err?.stack ?? err}\n`)
  } catch {
    /* nothing left to report to */
  }
  process.exit(1)
})
