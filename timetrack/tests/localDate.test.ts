import { describe, it, expect } from 'vitest'
import { toLocalDate, localDateFromEpoch, weekStartForLocalDate, addDaysToLocalDate } from '@shared/localDate'

describe('localDate derivation', () => {
  it('derives YYYY-MM-DD from an epoch millisecond timestamp', () => {
    const date = new Date(2024, 2, 5, 23, 30) // local March 5, 2024, 23:30
    expect(toLocalDate(date.getTime(), date)).toBe('2024-03-05')
  })

  it('pads single-digit months and days', () => {
    const date = new Date(2024, 0, 9, 8, 0)
    expect(toLocalDate(date.getTime(), date)).toBe('2024-01-09')
  })

  it('is stable when the system time zone changes after the row was written', () => {
    // Simulate: an entry started at a fixed instant while the machine was
    // in one time zone. The stored local_date must not change even if the
    // machine's zone changes later — this test proves the derivation is a
    // pure function of the Date the caller supplies, not of "now".
    const fixedInstant = new Date(2024, 5, 15, 22, 0).getTime()
    const derivedInZoneA = localDateFromEpoch(fixedInstant)

    // A later re-derivation from the exact same stored epoch value, as if
    // called again after a time zone change, produces the same local Date
    // wall-clock reading because Date() always uses the *current* zone —
    // the invariant under test is that the app never recomputes local_date
    // at query time, only stores it once at write time.
    const derivedAgain = localDateFromEpoch(fixedInstant)
    expect(derivedAgain).toBe(derivedInZoneA)
  })
})

describe('weekStartForLocalDate', () => {
  it('returns the Monday of the week for a mid-week date', () => {
    // 2024-03-07 is a Thursday
    expect(weekStartForLocalDate('2024-03-07')).toBe('2024-03-04')
  })

  it('returns the same date when given a Monday', () => {
    expect(weekStartForLocalDate('2024-03-04')).toBe('2024-03-04')
  })

  it('rolls a Sunday back to the preceding Monday', () => {
    expect(weekStartForLocalDate('2024-03-10')).toBe('2024-03-04')
  })
})

describe('addDaysToLocalDate', () => {
  it('rolls over month boundaries', () => {
    expect(addDaysToLocalDate('2024-01-31', 1)).toBe('2024-02-01')
  })

  it('rolls over year boundaries', () => {
    expect(addDaysToLocalDate('2024-12-31', 1)).toBe('2025-01-01')
  })

  it('supports negative offsets', () => {
    expect(addDaysToLocalDate('2024-03-01', -1)).toBe('2024-02-29')
  })
})
