import { describe, it, expect } from 'vitest'
import { formatDuration, formatDurationCompact, formatClock } from '@shared/duration'

describe('formatDuration', () => {
  it('formats zero seconds', () => {
    expect(formatDuration(0)).toBe('0 min')
  })

  it('formats under an hour', () => {
    expect(formatDuration(35 * 60)).toBe('35 min')
  })

  it('formats exactly one hour', () => {
    expect(formatDuration(60 * 60)).toBe('1 h 00 min')
  })

  it('formats over an hour with padded minutes', () => {
    expect(formatDuration(2 * 3600 + 15 * 60)).toBe('2 h 15 min')
  })

  it('formats double-digit hours', () => {
    expect(formatDuration(14 * 3600 + 8 * 60)).toBe('14 h 08 min')
  })

  it('truncates partial minutes down to whole minutes', () => {
    expect(formatDuration(90)).toBe('1 min')
  })

  it('never produces negative durations', () => {
    expect(formatDuration(-100)).toBe('0 min')
  })
})

describe('formatDurationCompact', () => {
  it('formats without spaces around units', () => {
    expect(formatDurationCompact(45 * 60)).toBe('45m')
    expect(formatDurationCompact(3 * 3600 + 5 * 60)).toBe('3h 05m')
  })
})

describe('formatClock', () => {
  it('formats under an hour as mm:ss', () => {
    expect(formatClock(65)).toBe('01:05')
  })

  it('formats an hour or more as hh:mm:ss', () => {
    expect(formatClock(3661)).toBe('01:01:01')
  })
})
