// Derives the YYYY-MM-DD local_date used for all daily/weekly/monthly
// grouping. This is computed ONCE, at write time, from the machine's local
// time zone. Reports group by this stored string and never re-derive it at
// query time — that is what keeps grouping stable if the clock or time
// zone changes later.

export function toLocalDate(epochMs: number, date: Date = new Date(epochMs)): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function localDateFromEpoch(epochMs: number): string {
  return toLocalDate(epochMs, new Date(epochMs))
}

/** Local YYYY-MM-DD for "today", using the machine's current time zone. */
export function todayLocalDate(now: number = Date.now()): string {
  return localDateFromEpoch(now)
}

/** Monday-start ISO week key (YYYY-MM-DD of that week's Monday) for a local_date string. */
export function weekStartForLocalDate(localDate: string): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const day = date.getDay() // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day
  date.setDate(date.getDate() + diffToMonday)
  return toLocalDate(date.getTime(), date)
}

export function monthForLocalDate(localDate: string): string {
  return localDate.slice(0, 7)
}

export function addDaysToLocalDate(localDate: string, days: number): string {
  const [y, m, d] = localDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toLocalDate(date.getTime(), date)
}
