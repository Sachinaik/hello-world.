// Single source of truth for duration display. Every screen in the app
// (and the CSV export's human-readable column) goes through this function.
// Raw decimal hours are never shown in the UI; they are an optional,
// separate CSV column computed independently.

export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const totalMinutes = Math.floor(safeSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) {
    return `${minutes} min`
  }

  const paddedMinutes = String(minutes).padStart(2, '0')
  return `${hours} h ${paddedMinutes} min`
}

export function formatDurationCompact(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.round(totalSeconds))
  const totalMinutes = Math.floor(safeSeconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${minutes}m`
  return `${hours}h ${String(minutes).padStart(2, '0')}m`
}

export function formatClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const seconds = safeSeconds % 60
  const hh = String(hours).padStart(2, '0')
  const mm = String(minutes).padStart(2, '0')
  const ss = String(seconds).padStart(2, '0')
  return hours > 0 ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`
}

export function secondsToDecimalHours(totalSeconds: number): number {
  return Math.round((totalSeconds / 3600) * 100) / 100
}
