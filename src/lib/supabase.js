import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = import.meta.env.VITE_SUPABASE_URL  || ''
const supabaseKey  = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Returns a real client if env vars are set, null otherwise (offline mode)
export const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null

export const isOnline = () => Boolean(supabase)

// ── Wallpaper Marketplace API ─────────────────────────────────────────────────

export async function fetchFeatured() {
  if (!supabase) return []
  const { data } = await supabase
    .from('wallpapers')
    .select('*')
    .eq('is_featured', true)
    .order('downloads', { ascending: false })
    .limit(12)
  return data ?? []
}

export async function searchWallpapers({ query = '', tags = [], page = 0 }) {
  if (!supabase) return []
  let q = supabase.from('wallpapers').select('*').order('downloads', { ascending: false })
  if (query) q = q.ilike('name', `%${query}%`)
  if (tags.length) q = q.overlaps('tags', tags)
  const { data } = await q.range(page * 20, page * 20 + 19)
  return data ?? []
}

export async function publishWallpaper({ name, description, tags, packageFile, previewFile }) {
  if (!supabase) throw new Error('Marketplace not connected')

  const user = (await supabase.auth.getUser()).data.user
  if (!user) throw new Error('Not signed in')

  // Upload preview image
  const previewPath = `previews/${user.id}/${Date.now()}_${previewFile.name}`
  await supabase.storage.from('wallpapers').upload(previewPath, previewFile)
  const { data: previewData } = supabase.storage.from('wallpapers').getPublicUrl(previewPath)

  // Upload .aura package
  const pkgPath = `packages/${user.id}/${Date.now()}_${packageFile.name}`
  await supabase.storage.from('wallpapers').upload(pkgPath, packageFile)
  const { data: pkgData } = supabase.storage.from('wallpapers').getPublicUrl(pkgPath)

  const { data, error } = await supabase.from('wallpapers').insert({
    author_id:   user.id,
    name,
    description,
    tags,
    preview_url: previewData.publicUrl,
    package_url: pkgData.publicUrl,
  }).select().single()

  if (error) throw error
  return data
}

export async function likeWallpaper(id) {
  if (!supabase) return
  await supabase.rpc('increment_likes', { row_id: id })
}

export async function signIn(email, password) {
  if (!supabase) throw new Error('Marketplace not connected')
  return supabase.auth.signInWithPassword({ email, password })
}

export async function signUp(email, password) {
  if (!supabase) throw new Error('Marketplace not connected')
  return supabase.auth.signUp({ email, password })
}

export async function signOut() {
  if (!supabase) return
  return supabase.auth.signOut()
}

export async function getSession() {
  if (!supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session
}
