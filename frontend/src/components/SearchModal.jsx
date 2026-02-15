import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

const API = '/api/v1'

export default function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [openingChat, setOpeningChat] = useState(null)
  const [error, setError] = useState('')
  const { fetchWithAuth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const q = query.trim().replace(/^@/, '')
    if (q.length < 2) {
      setResults([])
      return
    }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetchWithAuth(`/users/search?q=${encodeURIComponent(q)}&limit=20`)
        if (res.ok) setResults(await res.json())
        else setResults([])
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [open, query, fetchWithAuth])

  const openChatWithUser = async (u) => {
    if (openingChat) return
    setError('')
    setOpeningChat(u.id)
    try {
      const res = await fetchWithAuth(`/chats/dm/${u.id}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        const detail = Array.isArray(d.detail) ? d.detail.map((x) => x.msg || x).join('. ') : (d.detail || '')
        setError(detail || `Ошибка ${res.status}`)
        return
      }
      const chat = await res.json()
      onClose()
      navigate(`/chat/${chat.id}`)
    } catch (e) {
      setError(e.message || 'Ошибка')
    } finally {
      setOpeningChat(null)
    }
  }

  return (
    <AnimatePresence>
      {open && (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md glass-panel p-4 rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-lg opacity-80">@</span>
          <input
            type="text"
            placeholder="Поиск по username или имени..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-white/40"
            autoFocus
            onKeyDown={(e) => e.key === 'Escape' && onClose()}
          />
        </div>
        {loading && <p className="text-sm opacity-70">Поиск...</p>}
        {error && <p className="text-sm text-red-400 mb-2">{error}</p>}
        <ul className="max-h-64 overflow-y-auto space-y-1">
          {results.map((u) => (
            <li key={u.id}>
              <button
                type="button"
                disabled={openingChat !== null}
                className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 text-left disabled:opacity-60"
                onClick={() => openChatWithUser(u)}
              >
                <div className="w-10 h-10 rounded-full bg-indigo-500/40 flex items-center justify-center font-medium">
                  {(u.display_name || u.username || u.email || '?').slice(0, 1).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium">{u.display_name || (u.username ? `@${u.username}` : '—')}</p>
                  <p className="text-xs opacity-70">{u.username ? `@${u.username}` : (u.email || '—')}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs opacity-60 mt-2">Введите @ в чате для быстрого поиска</p>
        <button type="button" className="mt-3 w-full py-2 rounded-xl border border-white/20 hover:bg-white/10 text-sm" onClick={onClose}>
          Закрыть
        </button>
      </motion.div>
    </motion.div>
      )}
    </AnimatePresence>
  )
}
