import { test } from 'node:test'
import assert from 'node:assert/strict'
import { assertSecretKey } from '@/lib/supabase/server'

const jwt = (role: string) =>
  `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString('base64url')}.sig`

test('rejects publishable keys', () => {
  assert.throws(() => assertSecretKey('sb_publishable_abc123'), /publishable/)
})

test('rejects the legacy anon JWT', () => {
  assert.throws(() => assertSecretKey(jwt('anon')), /role "anon"/)
})

test('accepts secret and service_role keys', () => {
  assert.doesNotThrow(() => assertSecretKey('sb_secret_abc123'))
  assert.doesNotThrow(() => assertSecretKey(jwt('service_role')))
})
