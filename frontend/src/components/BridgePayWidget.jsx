import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'

const API = '/api/v1'

export default function BridgePayWidget({ chatId }) {
  const { user, token, fetchWithAuth, refreshUser } = useAuth()
  const [open, setOpen] = useState(false)
  const [toUserId, setToUserId] = useState('')
  const [amount, setAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const send = async (e) => {
    e.preventDefault()
    const uid = parseInt(toUserId, 10)
    const amt = parseFloat(amount)
    if (!uid || !amt || amt <= 0) return
    setError('')
    setLoading(true)
    try {
      const res = await fetchWithAuth('/users/transfer-light', {
        method: 'POST',
        body: JSON.stringify({ to_user_id: uid, amount: amt }),
      })
      if (res.ok) {
        await refreshUser()
        setOpen(false)
        setToUserId('')
        setAmount('')
      } else {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Ошибка перевода')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="mx-3 mb-1 py-1.5 px-3 rounded-xl text-sm bg-amber-500/20 border border-amber-500/30 text-amber-200 hover:bg-amber-500/30"
      >
        💡 Bridge Pay — перевести BRG
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mx-3 mb-2 overflow-hidden"
          >
            <div className="glass-panel p-3 rounded-2xl">
              <p className="text-xs opacity-80 mb-2">Перевод валюты BRG другу в чате</p>
              <form onSubmit={send} className="space-y-2">
                <input
                  type="number"
                  placeholder="ID пользователя"
                  value={toUserId}
                  onChange={(e) => setToUserId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm focus:outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="Сумма BRG"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm focus:outline-none"
                />
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <p className="text-xs opacity-60">Ваш баланс: {(user?.balance ?? 0).toFixed(2)} BRG</p>
                <div className="flex gap-2">
                  <button type="submit" disabled={loading} className="flex-1 py-2 rounded-xl bg-amber-500/80 text-black text-sm font-medium disabled:opacity-50">
                    {loading ? '…' : 'Отправить'}
                  </button>
                  <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-xl border border-white/20 text-sm">
                    Отмена
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
