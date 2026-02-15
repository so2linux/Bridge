import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

function ShieldIcon({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}

export default function Register() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [secretCode, setSecretCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAddAccount = new URLSearchParams(location.search).get('add') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(email, password, displayName, username.trim() || undefined, secretCode.trim())
      navigate('/')
    } catch (err) {
      setError(err.message || 'Ошибка регистрации')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-semibold mb-6 text-center">Регистрация в Bridge</h1>
        {isAddAccount && <p className="text-sm text-center opacity-80 mb-4">Добавление нового аккаунта — после регистрации он появится в меню.</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-red-500 text-sm text-center bg-red-500/10 rounded-xl py-2">{error}</p>
          )}
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
            required
          />
          <input
            type="text"
            placeholder="@username (5–12 латинских букв, необязательно)"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z]/g, '').slice(0, 12))}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
          />
          <input
            type="text"
            placeholder="Имя (необязательно)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
          />
          <input
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
            required
          />
          <input
            type="text"
            placeholder="Секретный код"
            value={secretCode}
            onChange={(e) => setSecretCode(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Регистрация…' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex gap-3 items-start">
          <ShieldIcon className="w-6 h-6 shrink-0 text-emerald-500 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">Ваши данные в безопасности</p>
            <p className="mt-1 text-emerald-600/90 dark:text-emerald-500/90">
              Пароль хранится в зашифрованном виде. Мы не передаём ваши данные третьим лицам и не используем их для рекламы.
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-sm opacity-80">
          Уже есть аккаунт? <Link to={isAddAccount ? '/login?add=1' : '/login'} className="underline">Войти</Link>
        </p>
      </GlassPanel>
    </div>
  )
}
