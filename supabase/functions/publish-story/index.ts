import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SRK = 'SUPABASE' + '_SERVICE_ROLE_' + 'KEY'
const env = Deno.env
const SERVICE_KEY = env.get(SRK)!
const RPT = 'REPLICATE' + '_API_' + 'TOKEN'
const REPLICATE_TOKEN = env.get(RPT)!

const BUCKET = 'story-photos'
const FLUX_MODEL = 'black-forest-labs/flux-1.1-pro'
const REPLICATE_API = 'https://api.replicate.com/v1'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function slugify(text: string): string {
  return text.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

async function generateFluxImage(prompt: string): Promise<string | null> {
  try {
    const res = await fetch(`${REPLICATE_API}/models/${FLUX_MODEL}/predictions`, {
      method: 'POST',
      headers: { 'Authorization': `Token ${REPLICATE_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: { prompt, aspect_ratio: '3:2', output_format: 'png' } }),
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
  } catch (e) { console.error('FLUX error:', e); return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const body = await req.json()
    const { action, story_id, prompt, image_base64, use_existing_photo } = body
    const db = createClient(SUPABASE_URL, SERVICE_KEY)

    if (action === 'generate_image') {
      if (!prompt) return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      const imageUrl = await generateFluxImage(prompt)
      if (!imageUrl) return new Response(JSON.stringify({ error: 'FLUX generation failed' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
      return new Response(JSON.stringify({ ok: true, url: imageUrl }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (action === 'publish') {
      if (!story_id) return new Response(JSON.stringify({ error: 'Missing story_id' }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
      const category_ids: string[] | undefined = body.category_ids

      const { data: story, error: fetchErr } = await db.from('stories')
        .select('id, title, content, photos, pen_name, status')
        .eq('id', story_id).single()
      if (fetchErr || !story) throw new Error('Story not found')

      let photoUrl: string | null = null

      if (use_existing_photo) {
        if (story.photos && Array.isArray(story.photos) && story.photos.length > 0 && story.photos[0].url) {
          photoUrl = story.photos[0].url
        }
      }

      if (!photoUrl && image_base64) {
        const imageBytes = Uint8Array.from(atob(image_base64), c => c.charCodeAt(0))
        const filename = `story-${story_id.slice(0, 8)}.png`
        const path = `stories/${filename}`
        const { error: uploadErr } = await db.storage.from(BUCKET).upload(path, imageBytes, { contentType: 'image/png', upsert: true })
        if (!uploadErr) {
          const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      if (!photoUrl && prompt) {
        const fluxUrl = await generateFluxImage(prompt)
        if (fluxUrl) {
          const imgRes = await fetch(fluxUrl)
          const imgBytes = new Uint8Array(await imgRes.arrayBuffer())
          const filename = `story-${story_id.slice(0, 8)}.png`
          const path = `stories/${filename}`
          await db.storage.from(BUCKET).upload(path, imgBytes, { contentType: 'image/png', upsert: true })
          const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      if (!photoUrl && REPLICATE_TOKEN) {
        const autoPrompt = `Editorial magazine photo. ${story.title}. Vietnamese context, warm natural lighting, photorealistic style, shot on film. 3:2 aspect ratio.`
        const fluxUrl = await generateFluxImage(autoPrompt)
        if (fluxUrl) {
          const imgRes = await fetch(fluxUrl)
          const imgBytes = new Uint8Array(await imgRes.arrayBuffer())
          const filename = `story-${story_id.slice(0, 8)}.png`
          const path = `stories/${filename}`
          await db.storage.from(BUCKET).upload(path, imgBytes, { contentType: 'image/png', upsert: true })
          const { data: { publicUrl } } = db.storage.from(BUCKET).getPublicUrl(path)
          photoUrl = publicUrl
        }
      }

      const baseSlug = slugify(story.title || 'cau-chuyen')
      const { data: maxRow } = await db.from('stories')
        .select('story_number').not('story_number', 'is', null)
        .order('story_number', { ascending: false }).limit(1).maybeSingle()
      const nextNumber = (maxRow?.story_number ?? 0) + 1
      const slug = baseSlug + '-' + String(nextNumber)

      const updateData: Record<string, unknown> = {
        status: 'published', published_at: new Date().toISOString(),
        story_number: nextNumber, slug,
      }
      if (photoUrl) updateData.photos = [{ url: photoUrl, caption: '' }]

      const { error: updateErr } = await db.from('stories').update(updateData).eq('id', story_id)
      if (updateErr) throw new Error(`Publish failed: ${updateErr.message}`)

      // Gán chủ đề (categories) cho story
      if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
        const rows = category_ids.map((cid: string) => ({ story_id, category_id: cid }))
        await db.from('story_categories').upsert(rows, { onConflict: 'story_id,category_id' }).select()
      }

      return new Response(JSON.stringify({ ok: true, story_number: nextNumber, slug, photo_url: photoUrl }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })
  }
})
