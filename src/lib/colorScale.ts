// Sequential blue ramp (100->700) from the dataviz palette, light mode.
const SEQUENTIAL_STOPS_LIGHT = [
  '#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7',
  '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b',
]
const SEQUENTIAL_STOPS_DARK = [
  '#184f95', '#1c5cab', '#256abf', '#2a78d6', '#3987e5', '#5598e7',
  '#6da7ec', '#86b6ef', '#9ec5f4', '#b7d3f6', '#cde2fb', '#e2eefc', '#f2f8fd',
]

function hexToRgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** t in [0,1] -> interpolated hex color along the sequential blue ramp. */
export function sequentialScale(t: number, isDark = false): string {
  const stops = isDark ? SEQUENTIAL_STOPS_DARK : SEQUENTIAL_STOPS_LIGHT
  const clamped = Math.max(0, Math.min(1, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.floor(scaled)
  const frac = scaled - i
  const a = hexToRgb(stops[i])
  const b = hexToRgb(stops[Math.min(i + 1, stops.length - 1)])
  const r = Math.round(lerp(a[0], b[0], frac))
  const g = Math.round(lerp(a[1], b[1], frac))
  const bl = Math.round(lerp(a[2], b[2], frac))
  return `rgb(${r}, ${g}, ${bl})`
}

export function useIsDarkMode(): boolean {
  if (typeof window === 'undefined') return false
  const root = document.documentElement
  if (root.getAttribute('data-theme') === 'dark') return true
  if (root.getAttribute('data-theme') === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}
