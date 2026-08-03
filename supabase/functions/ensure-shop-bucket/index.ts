// Edge function: ensure-shop-bucket — tạo bucket shop-products trên Supabase Storage
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

    // List existing buckets
    const { data: buckets, error: listErr } = await db.storage.listBuckets()
    if (listErr) throw new Error(`listBuckets: ${listErr.message}`)

    const BUCKET = 'shop-products'
    const exists = buckets?.some((b: { name: string }) => b.name === BUCKET)

    if (exists) {
      return new Response(JSON.stringify({ ok: true, created: false, message: 'Bucket đã tồn tại' }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // Create the bucket as public
    const { error: createErr } = await db.storage.createBucket(BUCKET, {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'],
      fileSizeLimit: 5242880, // 5MB
    })
    if (createErr) throw new Error(`createBucket: ${createErr.message}`)

    return new Response(JSON.stringify({ ok: true, created: true, message: 'Đã tạo bucket shop-products thành công!' }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
