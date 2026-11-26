/**
 * Keeps the desktop launcher's local server alive while this page is open.
 *
 * The ZIP edition's launcher (launcher.cjs) serves the app on 127.0.0.1 and
 * needs to know when the app window is truly gone. Watching the spawned
 * browser process is unreliable (Edge hands windows between its own processes,
 * especially on a fresh profile's first run), so the page itself pings
 * /__sba-ping every 15 seconds; the launcher shuts the server down only when
 * the pings stop. Harmless everywhere else: under the Electron build or the
 * dev server the path just falls through to the SPA fallback.
 */
export function startLauncherKeepalive() {
  const ping = () => {
    fetch('/__sba-ping', { cache: 'no-store' }).catch(() => {
      /* server gone or offline - nothing useful to do from here */
    })
  }
  ping()
  setInterval(ping, 15_000)
  // After system sleep the interval may not have fired for a long time -
  // ping immediately on wake/tab-return so the watchdog never wins the race.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') ping()
  })
}
