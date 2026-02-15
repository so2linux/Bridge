import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from './GlassPanel'

export default function SyncPointsWidget({ chatId }) {
  const { fetchWithAuth } = useAuth()
  const [data, setData] = useState(null)
  const [newItem, setNewItem] = useState('')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetchWithAuth(`/sync-points/chat/${chatId}`)
      if (cancelled) return
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    }
    load()
    return () => { cancelled = true }
  }, [chatId, fetchWithAuth])

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    const res = await fetchWithAuth(`/sync-points/chat/${chatId}/items`, {
      method: 'POST',
      body: JSON.stringify({ text: newItem.trim() }),
    })
    if (res.ok) {
      const item = await res.json()
      setData((prev) => ({
        ...prev,
        id: prev?.id,
        chat_id: chatId,
        title: prev?.title || 'Sync Points',
        items: [...(prev?.items || []), item],
      }))
      setNewItem('')
    }
  }

  const toggleItem = async (itemId) => {
    const res = await fetchWithAuth(`/sync-points/items/${itemId}/toggle`, { method: 'PATCH' })
    if (res.ok) {
      const { is_done } = await res.json()
      setData((prev) => ({
        ...prev,
        items: prev?.items?.map((i) => (i.id === itemId ? { ...i, is_done } : i)) || [],
      }))
    }
  }

  if (!data && !open) {
    return (
      <div className="px-3 py-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-sm text-indigo-400 hover:underline"
        >
          Sync Points (To-Do)
        </button>
      </div>
    )
  }

  return (
    <GlassPanel className="mx-3 mb-2 p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full text-left font-medium text-sm flex justify-between items-center"
      >
        {data?.title || 'Sync Points'}
        <span className="text-lg">{open ? '▼' : '▶'}</span>
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <ul className="space-y-1">
            {(data?.items || []).map((item) => (
              <li key={item.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={item.is_done}
                  onChange={() => toggleItem(item.id)}
                  className="rounded"
                />
                <span className={item.is_done ? 'line-through opacity-70 text-sm' : 'text-sm'}>
                  {item.text}
                </span>
              </li>
            ))}
          </ul>
          <form onSubmit={addItem} className="flex gap-2 mt-2">
            <input
              type="text"
              placeholder="Добавить пункт..."
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              className="flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-sm focus:outline-none"
            />
            <button type="submit" className="px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-sm">
              +
            </button>
          </form>
        </div>
      )}
    </GlassPanel>
  )
}
