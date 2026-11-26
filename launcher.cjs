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

function healthCheck(port, timeout = 1500) {
  return new Promise((resolve) => {
    const req = http.get({ host: '127.0.0.1', port, path: HEALTH_PATH, timeout }, (res) => {
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

/** Write the error file AND open it in Notepad - a silent text file next to the
 * app helped nobody diagnose "nothing happened". */
function reportFatal(message) {
  const file = path.join(__dirname, 'launcher-error.txt')
  try {
    fs.writeFileSync(file, `${APP_NAME} could not start\n================================\n\n${message}\n`)
    spawn('cmd.exe', ['/c', 'start', '', file], { stdio: 'ignore', windowsHide: true })
  } catch {
    /* nothing left to report to */
  }
}

// The open app page pings /__sba-ping every 15s (src/lib/launcherKeepalive.ts);
// the watchdog below shuts the server down once pings stop. Overridable for tests.
const KEEPALIVE_TIMEOUT_MS = Number(process.env.SBA_KEEPALIVE_TIMEOUT_MS) || 75_000
let lastPingAt = Date.now()

function startServer(port) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
        if (urlPath === '/__sba-ping') {
          lastPingAt = Date.now()
          res.writeHead(204)
          res.end()
          return
        }
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
    reportFatal(
      'The dist folder (the app itself) was not found next to launcher.cjs.\n\n' +
        'This usually means the download was not fully extracted - right-click the\n' +
        'downloaded ZIP, choose "Extract All...", and run "Solar & Battery Advisor.cmd"\n' +
        'from the extracted folder (not from inside the ZIP, and not a copied-out file).',
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
      // The port is busy but didn't answer the health probe just now. If it IS
      // this app (e.g. it was still starting up), hand off rather than climbing
      // the ladder - a different port is a different storage origin, and the
      // user's saved data would look like it vanished.
      if (await healthCheck(p, 3000)) {
        openAppWindow(`http://127.0.0.1:${p}/`)
        return
      }
    }
  }
  if (!server) {
    reportFatal(
      `Ports ${PORTS.join(', ')} are all in use by other programs, so the app's\n` +
        'local server could not start. Close other copies of the app (check Task\n' +
        'Manager for node.exe) or reboot, then try again.',
    )
    process.exit(1)
  }

  openAppWindow(`http://127.0.0.1:${port}/`)

  // Server lifetime is governed by the page's keepalive pings, NOT by watching
  // the spawned browser process - Edge hands windows between its own processes
  // (especially a fresh profile's first run relaunches itself), so a child-exit
  // signal says nothing reliable about whether the app window is still open.
  // Killing the server on a false signal is what produced the "127.0.0.1
  // refused to connect" / could-not-start reports. The page pings every 15s;
  // when pings stop for KEEPALIVE_TIMEOUT_MS the window is genuinely gone, and
  // a double-check 20s later guards against a just-woke-from-sleep race.
  lastPingAt = Date.now() // fresh grace window for the first page load
  const armWatchdog = () => {
    const watchdog = setInterval(() => {
      if (Date.now() - lastPingAt < KEEPALIVE_TIMEOUT_MS) return
      clearInterval(watchdog)
      // Double-check before dying: a machine that just woke from sleep can look
      // stale for a moment before the page's wake-ping lands.
      setTimeout(() => {
        if (Date.now() - lastPingAt < KEEPALIVE_TIMEOUT_MS) {
          armWatchdog() // the window is alive after all
        } else {
          server.close()
          process.exit(0)
        }
      }, 20_000)
    }, 10_000)
  }
  armWatchdog()
}

main().catch((err) => {
  reportFatal(`Unexpected error:\n\n${err?.stack ?? err}`)
  process.exit(1)
})
