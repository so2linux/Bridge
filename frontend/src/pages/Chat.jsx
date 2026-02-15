import React, { useEffect, useState, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'
import UserProfileModal from '../components/UserProfileModal'
import VoicePlayer from '../components/VoicePlayer'

export default function Chat() {
  const { chatId } = useParams()
  const { user, token, fetchWithAuth, refreshUser } = useAuth()
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [messageType, setMessageType] = useState('text')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [ws, setWs] = useState(null)
  const [chatDetail, setChatDetail] = useState(null)
  const [profileOpen, setProfileOpen] = useState(false)
  const [recording, setRecording] = useState(false)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const bottomRef = useRef(null)

  const chatIdNum = parseInt(chatId, 10)
  const validChatId = chatId && !Number.isNaN(chatIdNum)
  const otherUser = chatDetail?.members?.find((m) => m.id !== user?.id)

  useEffect(() => {
    if (!validChatId) {
      setLoadError('Чат не найден')
      setLoading(false)
      return
    }
    if (!token) {
      setLoadError('Войдите в аккаунт')
      setLoading(false)
      return
    }
    let cancelled = false
    setLoadError('')
    async function load() {
      try {
        const [res, resChat] = await Promise.all([
          fetchWithAuth(`/messages/chat/${chatId}`),
          fetchWithAuth(`/chats/${chatId}`),
        ])
        if (cancelled) return
        if (resChat?.ok) {
          const detail = await resChat.json()
          setChatDetail(detail)
        }
        if (res.ok) {
          setMessages(await res.json())
        } else {
          const d = await res.json().catch(() => ({}))
          const detail = d.detail
          let msg = 'Не удалось открыть чат'
          if (typeof detail === 'string') msg = detail
          else if (Array.isArray(detail) && detail.length) msg = detail.map((x) => x.msg ?? x.message ?? x).filter(Boolean).join('. ') || msg
          if (res.status === 403) msg = msg || 'Нет доступа к чату'
          if (res.status === 404) msg = msg || 'Чат не найден'
          setLoadError(`(${res.status}) ${msg}`)
        }
      } catch (err) {
        if (cancelled) return
        setLoadError('Нет связи с сервером. Запущен ли бэкенд на порту 8000? Проверьте консоль (F12).')
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [chatId, validChatId, token, fetchWithAuth])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const t = token || (typeof localStorage !== 'undefined' && localStorage.getItem('bridge_token'))
    if (!t) return
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(t)}`
    const socket = new WebSocket(wsUrl)
    socket.onopen = () => {
      socket.send(JSON.stringify({ action: 'subscribe_chat', chat_id: parseInt(chatId, 10) }))
    }
    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data)
        if (data.message) {
          // Своё сообщение уже добавлено из POST — не дублируем из WS
          if (data.message.sender_id === user?.id) return
          setMessages((prev) => [...prev, data.message])
        }
      } catch (_) {}
    }
    setWs(socket)
    return () => socket.close()
  }, [chatId, token, user?.id])

  const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥']
  const [reactingToId, setReactingToId] = useState(null)

  const setReaction = async (messageId, emoji) => {
    setReactingToId(null)
    const res = await fetchWithAuth(`/messages/${messageId}/reaction`, {
      method: 'POST',
      body: JSON.stringify({ emoji: emoji || null }),
    })
    if (res.ok) {
      const updated = await res.json()
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, reactions: updated.reactions || [], my_reaction: updated.my_reaction } : m)))
    }
  }

  const send = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    const res = await fetchWithAuth(`/messages/chat/${chatId}`, {
      method: 'POST',
      body: JSON.stringify({ content: input.trim(), message_type: messageType }),
    })
    if (res.ok) {
      const msg = await res.json()
      setMessages((prev) => [...prev, { ...msg, reactions: msg.reactions || [], my_reaction: msg.my_reaction }])
      setInput('')
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: 'message', chat_id: parseInt(chatId, 10), message: msg }))
      }
    }
  }

  const startVoice = () => {
    if (!navigator.mediaDevices?.getUserMedia) return
    setRecording(true)
    chunksRef.current = []
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const rec = new MediaRecorder(stream)
      recorderRef.current = rec
      rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], 'voice.webm', { type: 'audio/webm' })
        const formData = new FormData()
        formData.append('file', file)
        const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || ''
        const up = await fetch(`${base}/api/v1/upload/voice`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token || ''}` },
          body: formData,
        })
        const data = await up.json().catch(() => ({}))
        if (data.url) {
          const res = await fetchWithAuth(`/messages/chat/${chatId}`, {
            method: 'POST',
            body: JSON.stringify({ content: data.url, message_type: 'voice' }),
          })
          if (res.ok) {
            const msg = await res.json()
            setMessages((prev) => [...prev, { ...msg, reactions: [], my_reaction: null }])
            if (ws?.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ action: 'message', chat_id: parseInt(chatId, 10), message: msg }))
            }
          }
        }
      }
      rec.start()
    }).catch(() => setRecording(false))
  }

  const stopVoice = () => {
    if (recorderRef.current && recording) {
      recorderRef.current.stop()
      recorderRef.current = null
    }
    setRecording(false)
  }

  if (!validChatId || loadError) {
    return (
      <div className="p-4">
        <GlassPanel className="p-6 text-center">
          <p className="text-red-400 mb-3">{loadError || 'Чат не найден'}</p>
          <Link to="/" className="text-indigo-400 underline">← К списку чатов</Link>
        </GlassPanel>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <GlassPanel className="p-6 text-center">Загрузка…</GlassPanel>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {otherUser && (
        <button
          type="button"
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/10 transition-colors mb-2"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-500/40 flex items-center justify-center text-lg">
            {(otherUser.display_name || otherUser.email || '?').slice(0, 1).toUpperCase()}
          </div>
          <span className="font-medium">{otherUser.display_name || otherUser.email}</span>
          <span className="text-sm opacity-70">@{otherUser.email?.split('@')[0] || otherUser.id}</span>
        </button>
      )}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-3 chat-scroll">
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[85%] flex flex-col ${m.sender_id === user?.id ? 'items-end' : 'items-start'}`}>
              <div
                className={`rounded-2xl px-4 py-2 message-bubble ${
                  m.sender_id === user?.id ? 'message-bubble-own' : 'message-bubble-other'
                } ${m.message_type === 'echo' ? 'message-echo' : ''} ${m.message_type === 'gift' ? 'gift-glow' : ''}`}
              >
                {m.is_deleted ? (
                  <span className="italic opacity-60">Сообщение удалено</span>
                ) : m.message_type === 'voice' ? (
                  <VoicePlayer url={m.content} />
                ) : (
                  <p className="text-sm">{m.content}</p>
                )}
                {m.is_edited && <span className="text-xs opacity-60 ml-1">(ред.)</span>}
              </div>
              <div className={`flex items-center gap-1 mt-0.5 flex-wrap ${m.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                {(m.reactions || []).map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    onClick={() => setReaction(m.id, m.my_reaction === r.emoji ? null : r.emoji)}
                    className={`px-1.5 py-0.5 rounded-lg text-sm border transition-colors ${
                      m.my_reaction === r.emoji ? 'bg-indigo-500/30 border-indigo-400/50' : 'bg-white/10 border-white/20 hover:bg-white/20'
                    }`}
                    title="Нажми, чтобы поставить или убрать"
                  >
                    {r.emoji} {r.count > 1 ? r.count : ''}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setReactingToId(reactingToId === m.id ? null : m.id)}
                  className="p-0.5 rounded hover:bg-white/20 text-sm opacity-60 hover:opacity-100"
                  title="Реакция"
                >
                  +
                </button>
                {reactingToId === m.id && (
                  <span className="flex gap-0.5">
                    {REACTION_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setReaction(m.id, m.my_reaction === emoji ? null : emoji)}
                        className="p-0.5 rounded hover:bg-white/20 text-base"
                      >
                        {emoji}
                      </button>
                    ))}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <UserProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        userId={otherUser?.id}
        userName={otherUser?.display_name || otherUser?.email}
        chatId={chatIdNum}
        onSendGift={(msg) => { setMessages((prev) => [...prev, msg]); refreshUser?.(); }}
      />

      <form onSubmit={send} className="p-3 glass-panel rounded-2xl flex gap-2 items-end">
        <select
          value={messageType}
          onChange={(e) => setMessageType(e.target.value)}
          className="rounded-xl bg-white/10 border border-white/20 px-2 py-2 text-sm"
        >
          <option value="text">Текст</option>
          <option value="echo">Echo</option>
        </select>
        <input
          type="text"
          placeholder="Сообщение..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 focus:outline-none focus:border-white/40"
        />
        <button
          type="button"
          onPointerDown={startVoice}
          onPointerUp={stopVoice}
          onPointerLeave={stopVoice}
          className={`p-2.5 rounded-xl border transition-colors ${recording ? 'bg-red-500/50 border-red-400/50' : 'bg-white/10 border-white/20 hover:bg-white/20'}`}
          title="Удерживайте для записи голосового"
        >
          🎤
        </button>
        <motion.button
          type="submit"
          whileTap={{ scale: 0.96 }}
          transition={{ duration: 0.1 }}
          className="px-4 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium active:bg-indigo-700"
        >
          Отправить
        </motion.button>
      </form>
    </div>
  )
}
