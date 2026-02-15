import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

export default function ChatList() {
  const { fetchWithAuth } = useAuth()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const rChats = await fetchWithAuth('/chats/')
        if (cancelled) return
        if (rChats.ok) setChats(await rChats.json())
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [fetchWithAuth])

  if (loading) {
    return (
      <div className="p-4">
        <GlassPanel className="p-6 text-center">Загрузка чатов…</GlassPanel>
      </div>
    )
  }

  return (
    <div className="p-4">
      <GlassPanel className="p-2">
        <h2 className="font-semibold px-3 py-2 text-sm opacity-80">Чаты</h2>
        {chats.length === 0 ? (
          <p className="px-3 py-6 text-sm opacity-70 text-center">Пока нет чатов. Найди пользователя через поиск и начни диалог.</p>
        ) : (
          <ul className="divide-y divide-white/10">
            {chats.map((c) => {
              const name = c.display_title || c.title || `Чат ${c.id}`
              const letter = name.slice(0, 1).toUpperCase()
              return (
                <li key={c.id}>
                  <Link
                    to={`/chat/${c.id}`}
                    className="flex items-center gap-3 py-3 px-3 rounded-xl hover:bg-white/10 active:bg-white/15 transition-colors"
                  >
                    <div className="w-12 h-12 rounded-full bg-indigo-500/40 flex items-center justify-center text-lg font-medium shrink-0">
                      {letter}
                    </div>
                    <span className="font-medium truncate flex-1">{name}</span>
                    <span className="text-white/40 text-sm">›</span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </GlassPanel>
    </div>
  )
}
