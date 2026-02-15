import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import GiftModal from './GiftModal'

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1'

export default function UserProfileModal({ open, onClose, userId, userName, chatId, onSendGift }) {
  const { user, fetchWithAuth, refreshUser } = useAuth()
  const [profile, setProfile] = useState(null)
  const [gifts, setGifts] = useState([])
  const [transferAmount, setTransferAmount] = useState('')
  const [transferLoading, setTransferLoading] = useState(false)
  const [transferError, setTransferError] = useState('')
  const [giftModalOpen, setGiftModalOpen] = useState(false)

  useEffect(() => {
    if (!open || !userId) return
    setProfile(null)
    setGifts([])
    setTransferError('')
    fetchWithAuth(`/users/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
    fetchWithAuth(`/users/${userId}/gifts`)
      .then((r) => (r.ok ? r.json() : []))
      .then(setGifts)
  }, [open, userId, fetchWithAuth])

  const handleTransfer = async (e) => {
    e.preventDefault()
    const amount = parseFloat(transferAmount)
    if (!amount || amount <= 0) return
    setTransferError('')
    setTransferLoading(true)
    try {
      const res = await fetchWithAuth('/users/transfer-light', {
        method: 'POST',
        body: JSON.stringify({ to_user_id: userId, amount }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setTransferError(data.detail || 'Ошибка перевода')
        return
      }
      await refreshUser()
      setTransferAmount('')
      onClose?.()
    } finally {
      setTransferLoading(false)
    }
  }

  if (!open) return null

  const avatarUrl = profile?.avatar_url
    ? (profile.avatar_url.startsWith('http') ? profile.avatar_url : `${window.location.origin}${profile.avatar_url}`)
    : null

  return (
    <AnimatePresence>
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
          className="glass-panel rounded-2xl p-6 max-w-sm w-full shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold">Профиль</h3>
            <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-lg">
              ✕
            </button>
          </div>
          {profile && (
            <>
              <div className="flex flex-col items-center mb-4">
                <div className="w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-white/20 mb-2">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-3xl">
                      {(profile.display_name || profile.username || '?').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="font-medium text-lg">{profile.display_name || '—'}</p>
                {profile.username && <p className="text-sm text-indigo-300">@{profile.username}</p>}
                {profile.about_me && <p className="text-sm opacity-80 mt-2 text-center">{profile.about_me}</p>}
              </div>
              {(user?.username === 'admin' || user?.username === 'твой_ник') && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await fetchWithAuth(`/admin/users/${userId}/add-light`, {
                        method: 'POST',
                        body: JSON.stringify({ amount: 500 }),
                      })
                      if (res.ok) {
                        await refreshUser()
                        if (profile) setProfile((p) => ({ ...p, balance: (p.balance || 0) + 500 }))
                      }
                    }}
                    className="w-full py-2.5 rounded-xl bg-amber-500/80 text-black font-medium text-sm hover:bg-amber-500/90"
                  >
                    🎁 +500 BRG
                  </button>
                </div>
              )}
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setGiftModalOpen(true)}
                  className="flex-1 py-2.5 rounded-xl bg-amber-500/80 text-black font-medium text-sm hover:bg-amber-500/90"
                >
                  🎁 Подарить подарок
                </button>
                <form onSubmit={handleTransfer} className="flex-1 flex gap-1">
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="BRG"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="w-16 px-2 py-2 rounded-xl bg-white/10 border border-white/20 text-sm focus:outline-none"
                  />
                  <button type="submit" disabled={transferLoading} className="flex-1 py-2 rounded-xl bg-indigo-500/80 text-white text-sm font-medium disabled:opacity-50">
                    {transferLoading ? '…' : 'Отправить BRG'}
                  </button>
                </form>
              </div>
              {transferError && <p className="text-red-400 text-xs mb-2">{transferError}</p>}
              <div>
                <p className="text-xs opacity-70 mb-2">Подарки</p>
                <div className="grid grid-cols-4 gap-2 max-h-32 overflow-y-auto">
                  {gifts.length === 0 ? (
                    <p className="col-span-4 text-sm opacity-60">Нет подарков</p>
                  ) : (
                    gifts.map((g, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-white/10 border border-white/10 p-2 text-center"
                        title={g.sender_name ? `от ${g.sender_name}` : g.name}
                      >
                        <span className="text-xl block">{g.name.slice(0, 1)}</span>
                        <span className="text-xs truncate block">{g.name.slice(1, 12)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
          {!profile && <p className="text-sm opacity-70 py-4">Загрузка…</p>}
        </motion.div>
      </motion.div>

      <GiftModal
        open={giftModalOpen}
        onClose={() => setGiftModalOpen(false)}
        toUserId={userId}
        toUserName={profile?.display_name || userName}
        chatId={chatId}
        onSent={(msg) => { onSendGift?.(msg); setGiftModalOpen(false); onClose?.(); refreshUser?.(); }}
      />
    </AnimatePresence>
  )
}
