import React, { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

const API = '/api/v1'
const ADMIN_EMAIL = 'tfamilia816@gmail.com'

const DURATIONS = [
  { label: '1 час', hours: 1 },
  { label: '24 часа', hours: 24 },
  { label: '7 дней', days: 7 },
  { label: '30 дней', days: 30 },
  { label: 'Навсегда', forever: true },
]

export default function Admin() {
  const { user, fetchWithAuth } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalUser, setModalUser] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [lightAmount, setLightAmount] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    if (user?.email !== ADMIN_EMAIL) return
    setLoading(true)
    setError('')
    try {
      const res = await fetchWithAuth('/admin/stats')
      const text = await res.text()
      if (!res.ok) {
        let detail = ''
        try {
          const j = JSON.parse(text)
          detail = typeof j.detail === 'string' ? j.detail : (Array.isArray(j.detail) && j.detail[0]?.msg) ? j.detail.map((x) => x.msg).join(', ') : ''
        } catch (_) {}
        const extra = text ? ` Ответ: ${text.slice(0, 300)}` : ''
        throw new Error(detail ? `${detail}${extra}` : `Ошибка загрузки: ${res.status} ${res.statusText}.${extra}`)
      }
      const json = JSON.parse(text)
      setData(json)
    } catch (e) {
      setError(e.message || 'Ошибка загрузки')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user?.email !== ADMIN_EMAIL) return
    load()
  }, [user?.email])

  const runAction = async (path, body = {}) => {
    if (!modalUser) return
    setActionLoading(true)
    setMsg('')
    try {
      const res = await fetchWithAuth(path, {
        method: 'POST',
        body: Object.keys(body).length ? JSON.stringify(body) : undefined,
      })
      if (res.ok) {
        setMsg('Готово')
        load()
        if (path.includes('unban') || path.includes('unfreeze')) setModalUser(null)
      } else {
        const d = await res.json().catch(() => ({}))
        setMsg(d.detail || 'Ошибка')
      }
    } catch {
      setMsg('Ошибка запроса')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBan = (opt) => {
    runAction(`/admin/users/${modalUser.id}/ban`, {
      hours: opt.hours,
      days: opt.days,
      forever: opt.forever || false,
    })
  }

  const handleFreeze = (opt) => {
    runAction(`/admin/users/${modalUser.id}/freeze`, {
      hours: opt.hours,
      days: opt.days,
      forever: opt.forever || false,
    })
  }

  const handleAddLight = () => {
    const num = parseFloat(lightAmount)
    if (Number.isNaN(num) || num <= 0) {
      setMsg('Введите положительное число')
      return
    }
    runAction(`/admin/users/${modalUser.id}/add-light`, { amount: num })
    setLightAmount('')
  }

  if (user?.email !== ADMIN_EMAIL) {
    return (
      <div className="p-4">
        <GlassPanel className="p-6 text-center">
          <p className="text-red-400">Доступ только для администратора.</p>
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

  if (error) {
    return (
      <div className="p-4">
        <GlassPanel className="p-6 text-center text-red-400">{error}</GlassPanel>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <GlassPanel className="p-5">
        <h2 className="text-lg font-semibold mb-4">Админ-панель</h2>
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="p-3 rounded-xl bg-white/10">
            <p className="text-2xl font-bold">{data?.total ?? 0}</p>
            <p className="text-sm opacity-80">Всего зарегистрировано</p>
          </div>
          <div className="p-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30">
            <p className="text-2xl font-bold text-emerald-400">{data?.online_count ?? 0}</p>
            <p className="text-sm opacity-80">Сейчас онлайн</p>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-4 overflow-x-auto">
        <h3 className="font-medium mb-3">Пользователи (нажми на почту)</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/20 text-left">
              <th className="py-2 pr-2">ID</th>
              <th className="py-2 pr-2">Email</th>
              <th className="py-2 pr-2">@username</th>
              <th className="py-2 pr-2">Имя</th>
              <th className="py-2 pr-2">Статус</th>
              <th className="py-2 pr-2">Дата регистрации</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id} className="border-b border-white/10">
                <td className="py-2 pr-2">{u.id}</td>
                <td className="py-2 pr-2 break-all">
                  <button
                    type="button"
                    onClick={() => { setModalUser(u); setMsg(''); setLightAmount(''); }}
                    className="text-left underline hover:no-underline text-indigo-300"
                  >
                    {u.email}
                  </button>
                </td>
                <td className="py-2 pr-2">{u.username ? `@${u.username}` : '—'}</td>
                <td className="py-2 pr-2">{u.display_name || '—'}</td>
                <td className="py-2 pr-2">
                  {u.status === 'banned' && <span className="text-red-400">бан</span>}
                  {u.status === 'frozen' && <span className="text-amber-400">заморозка</span>}
                  {u.status === 'ok' && (u.online ? <span className="text-emerald-400">онлайн</span> : <span className="opacity-50">офлайн</span>)}
                </td>
                <td className="py-2 pr-2 opacity-80">{u.created_at ? new Date(u.created_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </GlassPanel>

      {modalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setModalUser(null)}>
          <GlassPanel className="w-full max-w-sm p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Действия: {modalUser.email}</h3>
              <button type="button" onClick={() => setModalUser(null)} className="p-1 rounded-lg hover:bg-white/10">✕</button>
            </div>
            {msg && <p className="text-sm mb-2 text-emerald-400">{msg}</p>}
            {actionLoading && <p className="text-sm opacity-70 mb-2">Запрос…</p>}

            <p className="text-xs opacity-70 mb-2">Заморозка</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {DURATIONS.map((d) => (
                <button key={d.label} type="button" disabled={actionLoading} onClick={() => handleFreeze(d)} className="px-2 py-1 rounded-lg bg-white/10 text-xs hover:bg-white/20 disabled:opacity-50">
                  {d.label}
                </button>
              ))}
            </div>
            {modalUser.status === 'frozen' && (
              <button type="button" disabled={actionLoading} onClick={() => runAction(`/admin/users/${modalUser.id}/unfreeze`)} className="mb-3 text-xs text-amber-400 underline">
                Снять заморозку
              </button>
            )}

            <p className="text-xs opacity-70 mb-2">Бан</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {DURATIONS.map((d) => (
                <button key={d.label} type="button" disabled={actionLoading} onClick={() => handleBan(d)} className="px-2 py-1 rounded-lg bg-red-500/20 text-xs hover:bg-red-500/30 disabled:opacity-50">
                  {d.label}
                </button>
              ))}
            </div>
            {modalUser.status === 'banned' && (
              <button type="button" disabled={actionLoading} onClick={() => runAction(`/admin/users/${modalUser.id}/unban`)} className="mb-3 text-xs text-red-400 underline">
                Разбанить
              </button>
            )}

            <p className="text-xs opacity-70 mb-2">Накрутка валюты BRG</p>
            <div className="flex gap-2">
              <input type="number" step="0.01" min="0" placeholder="Сумма" value={lightAmount} onChange={(e) => setLightAmount(e.target.value)} className="flex-1 px-3 py-2 rounded-xl bg-white/10 border border-white/20 text-sm" />
              <button type="button" disabled={actionLoading} onClick={handleAddLight} className="px-3 py-2 rounded-xl bg-amber-500/80 text-black text-sm font-medium disabled:opacity-50">
                Добавить
              </button>
            </div>
            <p className="text-xs opacity-50 mt-1">Баланс: {modalUser.balance ?? 0} BRG</p>
          </GlassPanel>
        </div>
      )}
    </div>
  )
}
