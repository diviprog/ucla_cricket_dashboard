import { supabase } from '@/lib/supabase/client'
import type { Player, PlayerAlias, MatchPlayerOverride } from '@/types/models'

// Cache for player lookups
let playerCache: Map<string, Player> | null = null
let aliasCache: Map<string, string> | null = null // alias -> player_id

/**
 * Initialize caches from database
 */
export async function initializePlayerCache(): Promise<void> {
  // Load all players
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
  
  if (playersError) {
    console.error('Error loading players:', playersError)
    return
  }
  
  playerCache = new Map()
  players?.forEach(player => {
    playerCache!.set(player.id, player)
    // Also index by canonical name (lowercase)
    playerCache!.set(player.name.toLowerCase(), player)
  })
  
  // Load all aliases
  const { data: aliases, error: aliasesError } = await supabase
    .from('player_aliases')
    .select('*')
  
  if (aliasesError) {
    console.error('Error loading aliases:', aliasesError)
    return
  }
  
  aliasCache = new Map()
  aliases?.forEach(alias => {
    aliasCache!.set(alias.alias.toLowerCase(), alias.player_id)
  })
}

/**
 * Clear caches (call after adding new players/aliases)
 */
export function clearPlayerCache(): void {
  playerCache = null
  aliasCache = null
}

/**
 * Normalize a player name (remove symbols, extra spaces, etc.)
 */
export function normalizePlayerName(rawName: string): string {
  return rawName
    .replace(/[*†‡]/g, '') // Remove special symbols
    .replace(/\s+/g, ' ')  // Normalize whitespace
    .trim()
}

/**
 * Resolve a player name to a player ID
 * Takes into account aliases and match-specific overrides
 */
export async function resolvePlayerName(
  rawName: string,
  matchId?: string
): Promise<{ playerId: string; playerName: string } | null> {
  // Ensure caches are initialized
  if (!playerCache || !aliasCache) {
    await initializePlayerCache()
  }
  
  const normalizedName = normalizePlayerName(rawName)
  const lowerName = normalizedName.toLowerCase()
  
  // 1. Check for match-specific override first
  if (matchId) {
    const { data: override } = await supabase
      .from('match_player_overrides')
      .select('actual_player_id')
      .eq('match_id', matchId)
      .eq('displayed_name', normalizedName)
      .single()
    
    if (override) {
      const player = playerCache!.get(override.actual_player_id)
      if (player) {
        return { playerId: override.actual_player_id, playerName: player.name }
      }
    }
  }
  
  // 2. Check alias cache
  const aliasPlayerId = aliasCache!.get(lowerName)
  if (aliasPlayerId) {
    const player = playerCache!.get(aliasPlayerId)
    if (player) {
      return { playerId: aliasPlayerId, playerName: player.name }
    }
  }
  
  // 3. Check direct player name match
  const directMatch = playerCache!.get(lowerName)
  if (directMatch) {
    return { playerId: directMatch.id, playerName: directMatch.name }
  }
  
  // 4. Try fuzzy matching (first name only)
  const firstName = lowerName.split(' ')[0]
  for (const [key, player] of playerCache!) {
    if (typeof key === 'string' && key.startsWith(firstName)) {
      return { playerId: player.id, playerName: player.name }
    }
  }
  
  // 5. Try matching by first name + last initial (e.g., "Naman S" -> "Naman Satija")
  const lastInitialMatch = lowerName.match(/^(\w+)\s+(\w)\.?$/)
  if (lastInitialMatch) {
    const [, first, lastInit] = lastInitialMatch
    for (const [key, player] of playerCache!) {
      if (typeof key === 'string') {
        const playerParts = key.split(' ')
        if (playerParts[0] === first && 
            playerParts.length > 1 && 
            playerParts[playerParts.length - 1].startsWith(lastInit)) {
          return { playerId: player.id, playerName: player.name }
        }
      }
    }
  }
  
  return null
}

/**
 * Create a new player if not found
 */
export async function createPlayerIfNotExists(name: string): Promise<string> {
  const normalizedName = normalizePlayerName(name)
  
  // Check if player exists
  const resolved = await resolvePlayerName(normalizedName)
  if (resolved) {
    return resolved.playerId
  }
  
  // Create new player
  const { data, error } = await supabase
    .from('players')
    .insert({ name: normalizedName })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating player:', error)
    throw error
  }
  
  // Also add the original name as an alias if different from normalized
  if (name !== normalizedName) {
    await addPlayerAlias(data.id, name)
  }
  
  // Clear cache to include new player
  clearPlayerCache()
  
  return data.id
}

/**
 * Add an alias for a player
 */
export async function addPlayerAlias(playerId: string, alias: string): Promise<void> {
  const normalizedAlias = normalizePlayerName(alias)
  
  const { error } = await supabase
    .from('player_aliases')
    .insert({ player_id: playerId, alias: normalizedAlias })
    .select()
  
  if (error && !error.message.includes('duplicate')) {
    console.error('Error adding alias:', error)
  }
  
  // Clear cache
  clearPlayerCache()
}

/**
 * Add a match-specific override (Player A played under Player B's name)
 */
export async function addMatchPlayerOverride(
  matchId: string,
  displayedName: string,
  actualPlayerId: string,
  notes?: string
): Promise<void> {
  const { error } = await supabase
    .from('match_player_overrides')
    .insert({
      match_id: matchId,
      displayed_name: normalizePlayerName(displayedName),
      actual_player_id: actualPlayerId,
      notes,
    })
  
  if (error) {
    console.error('Error adding override:', error)
    throw error
  }
}

/**
 * Get all players with their aliases
 */
export async function getAllPlayersWithAliases(): Promise<(Player & { aliases: string[] })[]> {
  const { data: players, error: playersError } = await supabase
    .from('players')
    .select('*')
    .order('name')
  
  if (playersError || !players) {
    console.error('Error loading players:', playersError)
    return []
  }
  
  const { data: aliases, error: aliasesError } = await supabase
    .from('player_aliases')
    .select('*')
  
  if (aliasesError) {
    console.error('Error loading aliases:', aliasesError)
  }
  
  // Group aliases by player
  const aliasMap = new Map<string, string[]>()
  aliases?.forEach(alias => {
    if (!aliasMap.has(alias.player_id)) {
      aliasMap.set(alias.player_id, [])
    }
    aliasMap.get(alias.player_id)!.push(alias.alias)
  })
  
  return players.map(player => ({
    ...player,
    aliases: aliasMap.get(player.id) || [],
  }))
}

