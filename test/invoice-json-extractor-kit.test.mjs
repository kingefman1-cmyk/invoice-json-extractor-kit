// node --test test/
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { handleExtract, MAX_TEXT } from '../functions/api/extract.js'
import { onRequestGet as config } from '../functions/api/config.js'

const KEY = 'ck_test_value'
const same = { 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }
const post = (body, headers = same) => new Request('https://invoices.example-site.com/api/extract', { method: 'POST', headers, body: typeof body === 'string' ? body : JSON.stringify(body) })
const j = (o, status = 200) => new Response(JSON.stringify(o), { status })
const parsed = { invoice_number: '1042', currency: 'EUR', total: 118, line_items: [{ description: 'Hosting', amount: 118 }], checks: { totals_match: true } }

test('an extraction posts the text to the invoice endpoint with the server-side key and returns the structured JSON', async () => {
  const calls = []
  const f = async (url, init) => { calls.push({ url: String(url), method: init.method, key: init.headers['X-Caelara-Key'], body: JSON.parse(init.body) }); return j(parsed) }
  const r = await handleExtract(post({ text: 'Invoice 1042 ... Total 118.00 EUR' }), { CAELARA_API_KEY: KEY }, f)
  const b = await r.json()
  assert.equal(r.status, 200); assert.equal(b.invoice_number, '1042'); assert.equal(b.total, 118); assert.equal(b.partial, false)
  assert.equal(calls.length, 1); assert.equal(calls[0].url, 'https://docs.caelaralabs.com/v1/invoice-json-composite'); assert.equal(calls[0].method, 'POST'); assert.equal(calls[0].key, KEY)
  assert.equal(calls[0].body.text, 'Invoice 1042 ... Total 118.00 EUR')
  assert.ok(!JSON.stringify(b).includes(KEY), 'the key never appears in a response')
})

test('input is validated before any paid call', async () => {
  const calls = []
  const f = async (...a) => { calls.push(a); return j(parsed) }
  for (const body of [{}, { text: '' }, { text: '  ' }, { text: 7 }, { text: 'x'.repeat(MAX_TEXT + 1) }, '{ nope', '[]']) assert.equal((await handleExtract(post(body), { CAELARA_API_KEY: KEY }, f)).status, 400)
  assert.equal(calls.length, 0)
})

test('only the site itself may call, a key must be set, and only POST is accepted', async () => {
  const f = async () => j(parsed)
  assert.equal((await handleExtract(post({ text: 'a' }, { 'Content-Type': 'application/json' }), { CAELARA_API_KEY: KEY }, f)).status, 403)
  assert.equal((await handleExtract(post({ text: 'a' }), {}, f)).status, 503)
  const r = await handleExtract(new Request('https://invoices.example-site.com/api/extract', { headers: same }), { CAELARA_API_KEY: KEY }, f)
  assert.equal(r.status, 405)
})

test('payment problems become a readable error, partial results are flagged, and oversized answers are refused', async () => {
  assert.equal((await handleExtract(post({ text: 'a' }), { CAELARA_API_KEY: KEY }, async () => j({}, 429))).status, 503)
  const p = await (await handleExtract(post({ text: 'a' }), { CAELARA_API_KEY: KEY }, async () => j({ ...parsed, partial: true }))).json()
  assert.equal(p.partial, true)
  const big = await handleExtract(post({ text: 'a' }), { CAELARA_API_KEY: KEY }, async () => j({ blob: 'x'.repeat(250000) }))
  assert.equal(big.status, 502)
  const c = await (await config({ env: { NEXT_PUBLIC_BRAND_NAME: 'Acme Invoices' } })).json()
  assert.equal(c.brand, 'Acme Invoices'); assert.equal(c.method, 'POST'); assert.equal(c.path, '/api/extract')
})
