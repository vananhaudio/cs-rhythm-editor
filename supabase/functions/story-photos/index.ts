// Edge function: story-photos — upload story images to Supabase Storage + update DB
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SRK = 'SUPABASE_SERVICE_ROLE_KEY'
const SERVICE_KEY = Deno.env.get(SRK)!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const BUCKET = 'story-photos'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { action, story_id, filename, image_base64 } = body

    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── Ensure bucket exists (public) ──
    if (action === 'ensure_bucket') {
      const { data: buckets } = await db.storage.listBuckets()
      const exists = buckets?.some((b: { name: string }) => b.name === BUCKET)
      if (!exists) {
        const { error } = await db.storage.createBucket(BUCKET, { public: true })
        if (error) throw new Error(`createBucket: ${error.message}`)
        return new Response(JSON.stringify({ ok: true, created: true }), { headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      return new Response(JSON.stringify({ ok: true, created: false }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Upload single image + update story ──
    if (action === 'upload') {
      if (!story_id || !filename || !image_base64) {
        return new Response(JSON.stringify({ error: 'Missing story_id, filename, or image_base64' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      }

      // Upload to storage
      const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
      const ext = filename.endsWith('.webp') ? 'webp' : 'png'
      const mimeType = ext === 'webp' ? 'image/webp' : 'image/png'
      const path = `stories/${filename}.${ext}`

      const { error: uploadErr } = await db.storage.from(BUCKET).upload(path, imageBytes, {
        contentType: mimeType,
        upsert: true,
      })
      if (uploadErr) throw new Error(`upload: ${uploadErr.message}`)

      // Get public URL
      const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)

      // Update story
      const { error: updateErr } = await db.from('stories')
        .update({ photos: [{ url: publicUrl, caption: '' }] })
        .eq('id', story_id)
      if (updateErr) throw new Error(`update: ${updateErr.message}`)

      return new Response(JSON.stringify({ ok: true, url: publicUrl, story_id }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
      })
    }

    // ── Fix pen_name encoding ──
    if (action === 'fix_names') {
      const fixes: Record<string, string> = {
        '84f25b89-1a70-432f-a680-503b21b28d2b': 'H\u01b0\u01a1ng',
        '03816b14-7daf-45da-ac8c-b9cc8442fd77': 'Tu\u1ea5n',
      }
      const results: string[] = []
      for (const [id, name] of Object.entries(fixes)) {
        const { error } = await db.from('stories').update({ pen_name: name }).eq('id', id)
        results.push(error ? `FAIL ${id}: ${error.message}` : `OK ${id} -> ${name}`)
      }
      return new Response(JSON.stringify({ results }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
