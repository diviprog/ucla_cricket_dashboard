import { z } from 'zod'
import type { ParsedMatchData } from '@/types/models'

const int = z.number().int().min(0)

/** Validates the ParsedMatchData that the upload page sends back to /api/matches/import. */
export const ParsedMatchSchema: z.ZodType<ParsedMatchData> = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  teams: z.tuple([z.string(), z.string()]),
  venue: z.string().optional(),
  competition: z.string().optional(),
  matchType: z.string().optional(),
  result: z.string().optional(),
  innings: z
    .array(
      z.object({
        team: z.string().min(1),
        battingEntries: z.array(
          z.object({
            playerName: z.string().min(1),
            runs: int,
            balls: int,
            fours: int,
            sixes: int,
            notOut: z.boolean(),
            dismissalText: z.string(),
            battingPosition: int,
            isBowledOrLBW: z.boolean(),
          })
        ),
        bowlingEntries: z.array(
          z.object({
            playerName: z.string().min(1),
            overs: z.number().min(0),
            balls: int,
            maidens: int,
            runs: int,
            wickets: int,
            dots: int,
            wides: int,
            noBalls: int,
            economy: z.number().min(0),
          })
        ),
        fieldingEntries: z.array(
          z.object({ playerName: z.string().min(1), catches: int, runOuts: int, stumpings: int })
        ),
        bowlerWicketEntries: z.array(
          z.object({
            bowlerName: z.string().min(1),
            dismissalType: z.enum(['caught', 'bowled', 'lbw', 'stumped', 'hit_wicket', 'other']),
          })
        ),
        total: int,
        wickets: int,
        overs: z.number().min(0),
        extras: int,
        extrasBreakdown: z
          .object({ total: int, wides: int, noBalls: int, byes: int, legByes: int })
          .optional(),
      })
    )
    .min(1)
    .max(2),
})
