// Edge function: publish-story
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SRK_NAME = 'SUPABASE_SERVICE_ROLE_KEY'
const SERVICE_KEY = Deno.env.get(SRK_NAME)!
const RP_NAME = 'REPLICATE_API_TOKEN'
const REPLICATE_TOKEN = Deno.env.get(RP_NAME)!

const BUCKET = 'story-photos'
const FLUX_MODEL = 'black-forest-labs/flux-1.1-pro'
const REPLICATE_API = 'https://api.replicate.com/v1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

async function generateFluxImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${REPLICATE_API}/models/${FLUX_MODEL}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${REPLICATE_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: { prompt, aspect_ratio: '3:2', output_format: 'png' },
      }),
    })
    const data = await res.json()
    if (data.error) { console.error('FLUX error:', data.error); return null }

    let result = data
    let attempts = 0
    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < 30) {
      await new Promise(r => setTimeout(r, 2000))
      const pollRes = await fetch(`${REPLICATE_API}/predictions/${data.id}`, {
        headers: { 'Authorization': `Token ${REPLICATE_TOKEN}` },
      })
      result = await pollRes.json()
      attempts++
    }

    if (result.status === 'succeeded' && result.output) {
      const urls = Array.isArray(result.output) ? result.output : [result.output]
      return urls[0] as string
    }
    return null
  } catch (e) {
    console.error('generateFluxImage error:', e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json()
    const { action, story_id, prompt, image_base64, use_existing_photo } = body
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    // ── Action: generate FLUX image ──
    if (action === 'generate_image') {
      if (!prompt) return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

      const imageUrl = await generateFluxImage(prompt)
      if (!imageUrl) return new Response(JSON.stringify({ error: 'FLUX generation failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })

      return new Response(JSON.stringify({ ok: true, url: imageUrl }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    // ── Action: publish story ──
    if (action === 'publish') {
      if (!story_id) return new Response(JSON.stringify({ error: 'Missing story_id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })

      let photoUrl: string | null = null

      // Option A: Use existing student photo
      if (use_existing_photo) {
        const { data: story } = await db.from('stories').select('photos').eq('id', story_id).single()
        if (story?.photos && Array.isArray(story.photos) && story.photos.length > 0 && story.photos[0].url) {
          photoUrl = story.photos[0].url
        }
      }

      // Option B: Upload provided image
      if (!photoUrl && image_base64) {
        const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
        const filename = `story-${story_id.slice(0, 8)}.png`
        const path = `stories/${filename}`
        const { error: uploadErr } = await db.storage.from(BUCKET).upload(path, imageBytes, {
          contentType: 'image/png', upsert: true,
        })
        if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`)
        const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
        photoUrl = publicUrl
      }

      // Option C: Generate FLUX image from prompt
      if (!photoUrl && prompt) {
        const fluxUrl = await generateFluxImage(prompt)
        if (fluxUrl) {
          const imgRes = await fetch(fluxUrl)
          const imgBytes = new Uint8Array(await imgRes.arrayBuffer())
          const filename = `story-${story_id.slice(0, 8)}.png`
          const path = `stories/${filename}`
          await db.storage.from(BUCKET).upload(path, imgBytes, {
            contentType: 'image/png', upsert: true,
          })
          const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      // Get next story number
      const { data: maxRow } = await db.from('stories')
        .select('story_number').not('story_number', 'is', null)
        .order('story_number', { ascending: false }).limit(1).maybeSingle()
      const nextNumber = (maxRow?.story_number ?? 0) + 1

      // Update story -> published
      const updateData: Record<string, unknown> = {
        status: 'published',
        published_at: new Date().toISOString(),
        story_number: nextNumber,
      }
      if (photoUrl) {
        updateData.photos = [{ url: photoUrl, caption: '' }]
      }

      const { error: updateErr } = await db.from('stories').update(updateData).eq('id', story_id)
      if (updateErr) throw new Error(`Publish failed: ${updateErr.message}`)

      return new Response(JSON.stringify({
        ok: true, story_number: nextNumber, photo_url: photoUrl,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
})
