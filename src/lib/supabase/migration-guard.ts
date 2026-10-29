// Code that reads players.is_ucla needs migrations/001-guests-intrasquad.sql.
// Until it is run, PostgREST answers 42703 "column ... is_ucla does not exist".
// Callers turn that into a clear error instead of silently showing unfiltered stats.

export const MIGRATION_REQUIRED_MESSAGE =
  'Database migration not applied: players.is_ucla is missing. Run src/lib/supabase/migrations/001-guests-intrasquad.sql in the Supabase SQL editor.'

type DbError = { code?: string; message?: string } | null | undefined

export function isMissingMigration(error: DbError): boolean {
  return !!error && error.code === '42703' && /is_ucla|team_side/.test(error.message || '')
}

/** Human-readable message for a query error, with the migration hint when that's the cause. */
export function describeDbError(error: DbError, fallback = 'Database query failed'): string {
  if (isMissingMigration(error)) return MIGRATION_REQUIRED_MESSAGE
  return error?.message || fallback
}
