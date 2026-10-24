import {
  compareTotals,
  getComparisonRanges,
  getPreviousRange,
} from './stats-comparison'

describe('compareTotals', () => {
  it('reports an increase', () => {
    expect(compareTotals(1500, 1000)).toEqual({
      current: 1500,
      previous: 1000,
      changePercent: 50,
      direction: 'up',
    })
  })

  it('reports a decrease', () => {
    expect(compareTotals(500, 1000)).toEqual({
      current: 500,
      previous: 1000,
      changePercent: -50,
      direction: 'down',
    })
  })

  it('reports flat when unchanged', () => {
    expect(compareTotals(1000, 1000).direction).toBe('flat')
    expect(compareTotals(1000, 1000).changePercent).toBe(0)
  })

  it('has no percentage when the previous period was empty', () => {
    expect(compareTotals(1000, 0)).toEqual({
      current: 1000,
      previous: 0,
      changePercent: null,
      direction: 'up',
    })
  })

  it('rounds to one decimal', () => {
    expect(compareTotals(1234, 1000).changePercent).toBe(23.4)
  })
})

describe('getPreviousRange', () => {
  it('returns the equally long range immediately before', () => {
    expect(getPreviousRange('2026-03-10', '2026-03-19')).toEqual({
      from: '2026-02-28',
      to: '2026-03-09',
    })
  })

  it('handles a single day', () => {
    expect(getPreviousRange('2026-03-01', '2026-03-01')).toEqual({
      from: '2026-02-28',
      to: '2026-02-28',
    })
  })

  it('crosses year boundaries', () => {
    expect(getPreviousRange('2026-01-01', '2026-01-31')).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
  })

  it('returns null for an unbounded or reversed range', () => {
    expect(getPreviousRange(undefined, '2026-01-01')).toBeNull()
    expect(getPreviousRange('2026-01-01', undefined)).toBeNull()
    expect(getPreviousRange('2026-02-01', '2026-01-01')).toBeNull()
  })
})

describe('getComparisonRanges', () => {
  it('uses the selected range', () => {
    expect(getComparisonRanges('2026-03-10', '2026-03-19')).toEqual({
      current: { from: '2026-03-10', to: '2026-03-19' },
      previous: { from: '2026-02-28', to: '2026-03-09' },
    })
  })

  it('compares the last 30 days with the previous 30 when unfiltered', () => {
    const now = new Date('2026-03-30T12:00:00Z')
    expect(getComparisonRanges(undefined, undefined, now)).toEqual({
      current: { from: '2026-03-01', to: '2026-03-30' },
      previous: { from: '2026-01-30', to: '2026-02-28' },
    })
  })
})
