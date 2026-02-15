import React, { useEffect, useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1'

export default function Stories() {
  const { fetchWithAuth, user, token } = useAuth()
  const [stories, setStories] = useState([])
  const [loading, setLoading] = useState(true)
  const [newText, setNewText] = useState('')
  const [posting, setPosting] = useState(false)
  const [mediaError, setMediaError] = useState('')
  const [mediaUploading, setMediaUploading] = useState(false)
  const mediaInputRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetchWithAuth('/stories')
      if (cancelled) return
      if (res.ok) setStories(await res.json())
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [fetchWithAuth])

  const postStory = async (e) => {
    e.preventDefault()
    if (!newText.trim() || posting) return
    setPosting(true)
    const res = await fetchWithAuth('/stories', {
      method: 'POST',
      body: JSON.stringify({ content_type: 'text', content: newText.trim() }),
    })
    if (res.ok) {
      const s = await res.json()
      setStories((prev) => [s, ...prev])
      setNewText('')
    }
    setPosting(false)
  }

  const postMediaStory = async (file) => {
    if (!token || mediaUploading) return
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    if (!isVideo && !isImage) {
      setMediaError('Только фото или видео (до 1 мин, MP4/WebM)')
      return
    }
    if (isVideo && file.size > 25 * 1024 * 1024) {
      setMediaError('Видео до ~1 минуты (макс. 25 МБ)')
      return
    }
    if (isImage && file.size > 10 * 1024 * 1024) {
      setMediaError('Фото не более 10 МБ')
      return
    }
    setMediaError('')
    setMediaUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API}/upload/story`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMediaError(data.detail || `Ошибка ${res.status}`)
        return
      }
      const content_type = data.content_type || (isVideo ? 'video' : 'photo')
      const postRes = await fetchWithAuth('/stories', {
        method: 'POST',
        body: JSON.stringify({ content_type, content: data.url }),
      })
      if (postRes.ok) {
        const s = await postRes.json()
        setStories((prev) => [s, ...prev])
      } else setMediaError('Не удалось опубликовать')
    } catch (err) {
      setMediaError(err.message || 'Ошибка загрузки')
    } finally {
      setMediaUploading(false)
    }
  }

  const onMediaSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) postMediaStory(file)
    e.target.value = ''
  }

  const byUser = {}
  stories.forEach((s) => {
    if (!byUser[s.user_id]) byUser[s.user_id] = []
    byUser[s.user_id].push(s)
  })

  const fullUrl = (path) => {
    if (!path) return ''
    return path.startsWith('http') ? path : `${window.location.origin}${path}`
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-4"
    >
      <GlassPanel className="p-4">
        <h2 className="font-semibold mb-3">Bridge Stories</h2>
        <p className="text-sm opacity-70 mb-4">Текст, фото или видео до 1 минуты. Исчезают через 24 часа.</p>
        <form onSubmit={postStory} className="flex gap-2 mb-3">
          <input
            type="text"
            placeholder="Текстовый статус..."
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            className="flex-1 px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none"
            maxLength={200}
          />
          <button type="submit" disabled={posting || !newText.trim()} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-sm font-medium disabled:opacity-50">
            Текст
          </button>
        </form>
        <div className="flex items-center gap-2">
          <input
            ref={mediaInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm"
            className="hidden"
            onChange={onMediaSelect}
          />
          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            disabled={mediaUploading}
            className="px-4 py-2 rounded-xl bg-amber-500/80 text-black text-sm font-medium disabled:opacity-50"
          >
            {mediaUploading ? 'Загрузка…' : 'Фото / Видео'}
          </button>
          {mediaError && <span className="text-sm text-red-400">{mediaError}</span>}
        </div>
      </GlassPanel>
      {loading ? (
        <GlassPanel className="p-6 text-center opacity-70">Загрузка...</GlassPanel>
      ) : stories.length === 0 ? (
        <GlassPanel className="p-6 text-center opacity-70">Пока нет историй</GlassPanel>
      ) : (
        <div className="space-y-3">
          {Object.entries(byUser).map(([uid, list]) => (
            <GlassPanel key={uid} className="p-4">
              <p className="text-xs opacity-60 mb-2">
                {list[0].user_id === user?.id ? 'Вы' : `User #${uid}`} · {list.length} записей
              </p>
              <ul className="space-y-3">
                {list.map((s) => (
                  <li key={s.id} className="py-2 border-b border-white/10 last:border-0">
                    {s.content_type === 'photo' && (
                      <img src={fullUrl(s.content)} alt="Story" className="rounded-xl max-h-64 object-contain w-full bg-black/20" />
                    )}
                    {s.content_type === 'video' && (
                      <video src={fullUrl(s.content)} controls className="rounded-xl max-h-64 w-full bg-black/20" />
                    )}
                    {s.content_type === 'text' && <span className="text-sm">{s.content}</span>}
                    {!['photo', 'video', 'text'].includes(s.content_type) && <span className="text-sm">{s.content}</span>}
                    <span className="text-xs opacity-50 block mt-1">{new Date(s.expires_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </GlassPanel>
          ))}
        </div>
      )}
    </motion.div>
  )
}
