// One-shot: run story_refactor.sql via Supabase Management API
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PROJECT = 'wojmdilyflffvdtpovmq'
const SRK = 'SUPABASE_SERVICE_ROLE_KEY'
const SERVICE_KEY = Deno.env.get(SRK)!
const MGMT_URL = `https://api.supabase.com/v1/projects/${PROJECT}/query`
const ACCESS_TOKEN = Deno.env.get('SUPABASE_ACCESS_TOKEN')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // Read SQL file content from request body
    const { sql } = await req.json()
    if (!sql) return new Response(JSON.stringify({ error: 'No SQL provided' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

    const res = await fetch(MGMT_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'apikey': SERVICE_KEY,
      },
      body: JSON.stringify({ query: sql }),
    })
    const data = await res.json()
    return new Response(JSON.stringify({ ok: res.ok, status: res.status, data }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
