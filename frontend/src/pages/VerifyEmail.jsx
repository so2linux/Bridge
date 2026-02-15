import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

export default function VerifyEmail() {
  const { user, completeVerify } = useAuth()
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputs = useRef([])
  const navigate = useNavigate()

  const handleChange = (i, v) => {
    if (!/^\d*$/.test(v)) return
    const next = [...code]
    next[i] = v.slice(-1)
    setCode(next)
    setError('')
    if (v && i < 5) inputs.current[i + 1]?.focus()
  }

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !code[i] && i > 0) {
      inputs.current[i - 1]?.focus()
      const next = [...code]
      next[i - 1] = ''
      setCode(next)
    }
  }

  const handlePaste = (e) => {
    e.preventDefault()
    const pasted = (e.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6)
    if (!pasted) return
    const next = [...code]
    pasted.split('').forEach((c, j) => { next[j] = c })
    setCode(next)
    setError('')
    const focusIdx = Math.min(pasted.length, 5)
    inputs.current[focusIdx]?.focus()
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const full = code.join('')
    if (full.length !== 6) {
      setError('Введите 6 цифр из письма')
      return
    }
    setError('')
    setLoading(true)
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')
    const url = `${base}/api/v1/auth/verify`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user?.email || '', otp_code: full }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        const errMsg = typeof data.detail === 'string' ? data.detail : data.detail?.message || 'Неверный или истёкший код'
        console.error('[Verify] Ошибка:', res.status, data)
        setError(errMsg)
        alert('Ошибка: ' + errMsg)
        return
      }
      if (data.access_token && data.user) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('token', data.access_token)
        }
        completeVerify(data.access_token, data.user)
        if (typeof window !== 'undefined') {
          setTimeout(() => { window.location.href = '/' }, 500)
        } else {
          navigate('/', { replace: true })
        }
      } else {
        console.error('[Verify] Нет токена в ответе:', data)
        setError('Нет токена в ответе')
        alert('Ошибка: нет токена в ответе')
      }
    } catch (err) {
      const msg = err?.message || 'Сеть или сервер недоступен'
      console.error('[Verify] Исключение:', err)
      setError(msg)
      alert('Ошибка: ' + msg)
    } finally {
      setLoading(false)
    }
  }

  const isTestEmail = user?.email && ['kalandarovtimur111@gmail.com', 'tfamilia816@gmail.com'].includes(user.email)

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-sm p-6">
        <h1 className="text-xl font-semibold mb-2 text-center">Подтверждение email</h1>
        <p className="text-sm text-center opacity-80 mb-2">
          Мы отправили 6-значный код на {user?.email || 'ваш email'}. Введите его ниже.
        </p>
        <p className="text-xs text-center text-amber-400/90 mb-4">
          Для теста введи 111111.
        </p>
        {isTestEmail && (
          <p className="text-xs text-center text-amber-400/90 mb-2">
            Для тестового аккаунта подойдёт любой 6-значный код.
          </p>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-red-500 text-sm text-center bg-red-500/10 rounded-xl py-2">{error}</p>
          )}
          <div className="flex justify-center gap-2" onPaste={handlePaste}>
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => { inputs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={c}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className="w-11 h-12 text-center text-lg rounded-xl bg-white/10 border border-white/20 focus:border-indigo-400 focus:outline-none transition-colors"
              />
            ))}
          </div>
          <button
            type="submit"
            disabled={loading || code.join('').length !== 6}
            className="w-full py-3 rounded-xl font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Проверка…' : 'Подтвердить'}
          </button>
        </form>
        <p className="mt-4 text-xs text-center opacity-70">
          Код действителен 15 минут. В продакшене он придёт на почту; в разработке смотри консоль бэкенда.
        </p>
      </GlassPanel>
    </div>
  )
}
