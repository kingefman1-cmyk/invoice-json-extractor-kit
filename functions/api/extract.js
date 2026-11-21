// POST /api/extract   { "text": "Invoice 1042 ... Total 118.00 EUR" }
// One call: raw invoice text in, structured JSON out (number, dates, currency, line items, totals) with consistency checks.
import { callCaelara, gate, json, readJsonBody } from '../../lib/proxy.js'

export const DOCS_HOST = 'https://docs.caelaralabs.com'
export const MAX_TEXT = 20000
const MAX_RESPONSE = 200000

export async function handleExtract(request, env, fetcher = fetch) {
  if (request.method !== 'POST') return json({ error: 'Send a POST with {"text": "..."}.' }, 405, { Allow: 'POST' })
  const blocked = gate(request, env)
  if (blocked) return blocked
  const b = await readJsonBody(request, MAX_TEXT * 4 + 1024)
  if (b.error) return json({ error: b.error }, 400)
  const text = b.value.text
  if (typeof text !== 'string' || !text.trim() || text.length > MAX_TEXT) return json({ error: `text must be 1 to ${MAX_TEXT} characters.` }, 400)
  const r = await callCaelara(fetcher, `${DOCS_HOST}/v1/invoice-json-composite`, env.CAELARA_API_KEY, { method: 'POST', body: { text } })
  if (!r.ok) return json({ error: r.error }, r.status)
  if (JSON.stringify(r.body).length > MAX_RESPONSE) return json({ error: 'The result was too large to return.' }, 502)
  return json({ ...r.body, partial: r.body.partial === true })
}

export const onRequest = ({ request, env }) => handleExtract(request, env)
