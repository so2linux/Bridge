import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

export default function GiftModal({ open, onClose, toUserId, toUserName, chatId, onSent }) {
  const { user, fetchWithAuth, refreshUser } = useAuth()
  const [catalog, setCatalog] = useState([])
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [selectedGiftId, setSelectedGiftId] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return
    setError('')
    setSelectedGiftId(null)
    setMessage('')
    let cancelled = false
    setLoading(true)
    fetchWithAuth('/gifts/catalog')
      .then((r) => r.ok ? r.json() : [])
      .then((list) => { if (!cancelled) setCatalog(list) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open, fetchWithAuth])

  const send = async (e) => {
    e.preventDefault()
    if (!selectedGiftId || !toUserId) return
    setError('')
    setSending(true)
    try {
      const res = await fetchWithAuth('/gifts/send-gift', {
        method: 'POST',
        body: JSON.stringify({
          to_user_id: toUserId,
          gift_id: selectedGiftId,
          message: message.trim() || undefined,
          chat_id: chatId || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.detail || 'Не удалось отправить подарок')
        return
      }
      await refreshUser()
      if (data.message) onSent?.(data.message)
      onClose?.()
    } finally {
      setSending(false)
    }
  }

  const selectedGift = catalog.find((g) => g.id === selectedGiftId)
  const canSend = selectedGift && (user?.balance ?? 0) >= (selectedGift?.price ?? 0)

  return (
    <AnimatePresence>
      {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-panel rounded-2xl p-6 max-w-md w-full max-h-[85vh] flex flex-col shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">🎁 Подарок для {toUserName || 'получателя'}</h3>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-lg">
              ✕
            </button>
          </div>
          <p className="text-xs opacity-80 mb-3">Ваш баланс: {(user?.balance ?? 0).toFixed(2)} BRG</p>
          {loading ? (
            <p className="text-sm opacity-70 py-4">Загрузка каталога…</p>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 mb-4">
                {catalog.map((g) => {
                  const emoji = g.name?.split(/\s/)[0] || '🎁'
                  return (
                    <button
                      key={g.id}
                      type="button"
                      onClick={() => setSelectedGiftId(g.id)}
                      className={`glass-panel aspect-square flex flex-col items-center justify-center p-4 rounded-2xl border transition-all ${
                        selectedGiftId === g.id ? 'border-amber-500/60 ring-2 ring-amber-500/30' : 'border-white/20 hover:bg-white/10'
                      }`}
                    >
                      <span className="text-4xl mb-1">{emoji}</span>
                      <span className="text-xs opacity-90">{g.price?.toFixed(0)} BRG</span>
                    </button>
                  )
                })}
              </div>
              <form onSubmit={send} className="space-y-3">
                <input
                  type="text"
                  placeholder="Короткое сообщение к подарку (необязательно)"
                  value={message}
                  onChange={(e) => setMessage(e.target.value.slice(0, 500))}
                  maxLength={500}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-sm focus:outline-none focus:border-white/40"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={!canSend || sending}
                    className="flex-1 py-2.5 rounded-xl bg-amber-500/80 text-black font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {sending ? '…' : 'Отправить подарок'}
                  </button>
                  <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-white/20 text-sm">
                    Отмена
                  </button>
                </div>
              </form>
            </>
          )}
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  )
}
