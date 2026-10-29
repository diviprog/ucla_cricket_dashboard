import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchPlayerName } from '@/lib/parsers/player-resolver'
import type { Player } from '@/types/models'

const p = (id: string, name: string): Player => ({ id, name, is_ucla: true, created_at: '2025-01-01' })

// Real roster names, including the risky prefix pairs
const roster: Player[] = [
  p('1', 'Adi'), p('2', 'Aditya Dixit'),
  p('3', 'Arya'), p('4', 'aryan s'),
  p('5', 'Deva Yarlagadda'), p('6', 'Devansh Mishra'),
  p('7', 'Dhruv Patel'), p('8', 'Dhruva Iyer'),
  p('9', 'Parik'), p('10', 'Parikh Bruins'),
  p('11', 'Ayush Minga'), p('12', 'Ayush Monga'),
  p('13', 'Sahil Bahety'), p('14', 'Sahil Shah'),
  p('15', 'Naman Satija'),
]
const aliases = new Map([['devansh m', '6'], ['d mishra', '6']])

const id = (name: string, players = roster) => matchPlayerName(name, players, aliases)?.playerId ?? null

test('exact alias, case-insensitive', () => {
  assert.equal(id('Devansh M'), '6')
  assert.equal(id('D MISHRA'), '6')
})

test('exact canonical name, case-insensitive and ignoring symbols', () => {
  assert.equal(id('Aditya Dixit'), '2')
  assert.equal(id('adi'), '1')
  assert.equal(id('Dhruv Patel*'), '7')
})

test('first name + last initial when unique', () => {
  assert.equal(id('Naman S'), '15')
  assert.equal(id('Naman S.'), '15')
  assert.equal(id('Deva Y'), '5')
  assert.equal(id('Ayush Mi'), null) // not a single initial
})

test('ambiguous last initial returns null', () => {
  assert.equal(id('Ayush M'), null) // Minga and Monga
  assert.equal(id('Sahil B'), '13')
  assert.equal(id('Sahil S'), '14')
})

test('first-name prefix never matches', () => {
  assert.equal(id('Raj Patel', [p('r', 'Rajesh Kumar')]), null)
  assert.equal(id('Dhruv I'), null) // Dhruva Iyer is a different first name
  assert.equal(id('Parik B'), null) // Parikh Bruins is a different first name
  assert.equal(id('Ary'), null)
})

test('never matches on player ids', () => {
  assert.equal(id('1'), null)
})
