/**
 * Shared dismissal-text rules used by both scorecard parsers.
 */

/**
 * True when the batter finished the innings not out.
 * "not out", "retired hurt", "retired not out", "retd hurt" -> not out.
 * "retired out" -> out.
 */
export function isNotOutDismissal(dismissalText: string): boolean {
  const lower = dismissalText.toLowerCase().replace(/\s+/g, ' ').trim()
  if (lower === 'retired out' || lower === 'retd out') return false
  if (lower.includes('not out')) return true
  return /^(retired|retd)\b/.test(lower)
}

/**
 * True when the row is not an innings at all ("dnb", "did not bat", "absent").
 */
export function isDidNotBat(dismissalText: string): boolean {
  const lower = dismissalText.toLowerCase().replace(/\s+/g, ' ').trim()
  return /^(dnb|did not bat|absent)\b/.test(lower)
}
