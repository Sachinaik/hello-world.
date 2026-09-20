import { todayLocalDate, weekStartForLocalDate } from '@shared/localDate'

export function currentLocalDateRange(): { today: string; weekStart: string } {
  const today = todayLocalDate()
  const weekStart = weekStartForLocalDate(today)
  return { today, weekStart }
}
