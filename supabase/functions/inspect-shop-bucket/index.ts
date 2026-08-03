// Edge function: inspect-shop-bucket — kiểm tra cấu hình bucket shop-products
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // List all buckets
    const { data: buckets, error: listErr } = await db.storage.listBuckets()
    if (listErr) throw new Error(`listBuckets: ${listErr.message}`)

    const target = 'shop-products'
    const bucket = buckets?.find((b: any) => b.name === target)

    if (!bucket) {
      return new Response(JSON.stringify({ ok: false, error: 'Bucket not found', buckets: buckets?.map(b => b.name) }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Try to list objects in the bucket
    const { data: objects, error: objErr } = await db.storage.from(target).list('products', { limit: 5 })

    return new Response(JSON.stringify({
      ok: true,
      bucket: {
        name: bucket.name,
        public: bucket.public,
        owner: bucket.owner,
        file_size_limit: bucket.file_size_limit,
        allowed_mime_types: bucket.allowed_mime_types,
        created_at: bucket.created_at,
        updated_at: bucket.updated_at,
      },
      objects: objects?.map(o => ({ name: o.name, id: o.id })),
      objErr: objErr?.message || null,
    }, null, 2), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
