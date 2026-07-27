function computeEasterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(year, month - 1, day)
}

function nthMondayOfMonth(year: number, month: number, n: number): Date {
  const date = new Date(year, month, 1)
  let mondaysFound = 0
  while (true) {
    if (date.getDay() === 1) {
      mondaysFound++
      if (mondaysFound === n) return new Date(date)
    }
    date.setDate(date.getDate() + 1)
  }
}

function toKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Minimum common-across-states Australian public holiday set, approximated (no weekend-substitute-day logic). */
function buildHolidaySet(years: number[]): Set<string> {
  const dates: Date[] = []
  for (const year of years) {
    const easterSunday = computeEasterSunday(year)
    const goodFriday = new Date(easterSunday)
    goodFriday.setDate(goodFriday.getDate() - 2)
    const easterMonday = new Date(easterSunday)
    easterMonday.setDate(easterMonday.getDate() + 1)

    dates.push(
      new Date(year, 0, 1), // New Year's Day
      new Date(year, 0, 26), // Australia Day
      goodFriday,
      easterMonday,
      new Date(year, 3, 25), // Anzac Day
      nthMondayOfMonth(year, 5, 2), // King's Birthday (2nd Monday in June, national approximation)
      new Date(year, 11, 25), // Christmas Day
      new Date(year, 11, 26), // Boxing Day
    )
  }
  return new Set(dates.map(toKey))
}

const HOLIDAY_SET = buildHolidaySet([2026, 2027, 2028])

export function isPublicHoliday(date: Date): boolean {
  return HOLIDAY_SET.has(toKey(date))
}
