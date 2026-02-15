import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1'

export default function Profile() {
  const { user, logout, fetchWithAuth, refreshUser, token } = useAuth()
  const navigate = useNavigate()
  const [lanternLoading, setLanternLoading] = useState(false)
  const [lanternError, setLanternError] = useState('')
  const [aboutMe, setAboutMe] = useState(user?.about_me ?? '')
  const [aboutSaving, setAboutSaving] = useState(false)
  const [aboutMsg, setAboutMsg] = useState('')
  const [avatarLoading, setAvatarLoading] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const [gifts, setGifts] = useState([])
  const fileInputRef = useRef(null)

  React.useEffect(() => {
    if (!token) return
    fetchWithAuth('/gifts/inventory')
      .then((r) => (r.ok ? r.json() : []))
      .then(setGifts)
      .catch(() => setGifts([]))
  }, [token, fetchWithAuth])

  React.useEffect(() => {
    setAboutMe(user?.about_me ?? '')
  }, [user?.about_me])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const handleLightLantern = async () => {
    setLanternError('')
    setLanternLoading(true)
    try {
      const res = await fetchWithAuth('/users/light-lantern', { method: 'POST' })
      if (res.ok) {
        await refreshUser()
      } else {
        const d = await res.json().catch(() => ({}))
        setLanternError(d.detail || 'Не удалось')
      }
    } finally {
      setLanternLoading(false)
    }
  }

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !token) return
    if (!file.type.startsWith('image/')) {
      setAvatarError('Выберите изображение (JPEG, PNG, GIF, WebP)')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError('Размер не более 5 МБ')
      return
    }
    setAvatarError('')
    setAvatarLoading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`${API}/upload/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setAvatarError(data.detail || `Ошибка ${res.status}`)
        return
      }
      if (data.url) {
        const patch = await fetchWithAuth('/users/me', {
          method: 'PATCH',
          body: JSON.stringify({ avatar_url: data.url }),
        })
        if (patch.ok) await refreshUser()
        else setAvatarError('Не удалось обновить профиль')
      }
    } catch (err) {
      setAvatarError(err.message || 'Ошибка загрузки')
    } finally {
      setAvatarLoading(false)
      e.target.value = ''
    }
  }

  const saveAboutMe = async () => {
    setAboutMsg('')
    setAboutSaving(true)
    try {
      const res = await fetchWithAuth('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ about_me: aboutMe }),
      })
      if (res.ok) {
        await refreshUser()
        setAboutMsg('Сохранено')
      } else {
        const d = await res.json().catch(() => ({}))
        setAboutMsg(d.detail || 'Ошибка')
      }
    } finally {
      setAboutSaving(false)
    }
  }

  const avatarUrl = user?.avatar_url ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${window.location.origin}${user.avatar_url}`) : null

  return (
    <div className="p-4 space-y-4">
      <GlassPanel className="p-6">
        <h2 className="text-lg font-semibold mb-4">Профиль</h2>
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarLoading}
              className="block w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/20 hover:border-indigo-400/50 transition-colors disabled:opacity-50"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Аватар" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl text-white/60">👤</span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarChange}
            />
            {avatarLoading && <p className="text-xs mt-1 text-amber-400">Загрузка…</p>}
            {avatarError && <p className="text-xs mt-1 text-red-400">{avatarError}</p>}
          </div>
          <div className="min-w-0 flex-1">
            {user?.username && (
              <p className="text-sm font-medium text-indigo-300">@{user.username}</p>
            )}
            <p className="text-sm opacity-80">{user?.email}</p>
            <p className="text-sm mt-1">{user?.display_name || '—'}</p>
            <p className="text-xs mt-1 opacity-60">Нажми на аватар, чтобы поставить фото</p>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="font-semibold mb-2">О себе</h3>
        <textarea
          value={aboutMe}
          onChange={(e) => setAboutMe(e.target.value)}
          placeholder="Расскажите о себе..."
          rows={4}
          className="w-full px-4 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-y"
        />
        <div className="flex items-center gap-2 mt-2">
          <button
            type="button"
            onClick={saveAboutMe}
            disabled={aboutSaving}
            className="px-4 py-2 rounded-xl bg-indigo-500/80 text-white text-sm font-medium disabled:opacity-50"
          >
            {aboutSaving ? '…' : 'Сохранить'}
          </button>
          {aboutMsg && <span className="text-sm text-emerald-400">{aboutMsg}</span>}
        </div>
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="font-semibold mb-2">Валюта BRG</h3>
        <p className="text-2xl font-bold text-amber-400/90">{(user?.balance ?? 0).toFixed(2)} BRG</p>
        <p className="text-sm opacity-80 mb-2">+0.01 BRG за сообщение; фонарь раз в 24ч.</p>
        <button
          type="button"
          onClick={handleLightLantern}
          disabled={lanternLoading}
          className="mt-4 w-full py-3 rounded-xl font-medium bg-amber-500/80 hover:bg-amber-500 text-black transition-colors disabled:opacity-50"
        >
          {lanternLoading ? '…' : 'Зажечь фонарь (+1 BRG раз в 24ч)'}
        </button>
        {lanternError && (
          <p className="mt-2 text-sm text-red-400">{lanternError}</p>
        )}
      </GlassPanel>

      <GlassPanel className="p-6">
        <h3 className="font-semibold mb-2">Подарки</h3>
        <p className="text-sm opacity-80 mb-3">Полученные подарки (иконки). Кирпич, Фонарь, Маяк — отправляются из чата за BRG.</p>
        {gifts.length === 0 ? (
          <p className="text-sm opacity-60">Пока нет подарков</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {gifts.map((g) => (
              <div
                key={g.id}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 border border-white/10"
                title={g.sender_name ? `От ${g.sender_name}` : g.name}
              >
                <span className="text-2xl" title={g.name}>🎁</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  {g.sender_name && <p className="text-xs opacity-70 truncate">от {g.sender_name}</p>}
                  {g.message_text && <p className="text-xs opacity-60 italic truncate max-w-[180px]">&quot;{g.message_text}&quot;</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      <button
        type="button"
        onClick={handleLogout}
        className="w-full py-3 rounded-xl font-medium border border-red-400/50 text-red-400 hover:bg-red-400/10 transition-colors"
      >
        Выйти
      </button>
    </div>
  )
}
