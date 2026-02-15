import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import GlassPanel from '../components/GlassPanel'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const isAddAccount = new URLSearchParams(location.search).get('add') === '1'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err.message || 'Ошибка входа')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <GlassPanel className="w-full max-w-sm p-6">
        <h1 className="text-2xl font-semibold mb-6 text-center">Вход в Bridge</h1>
        {isAddAccount && <p className="text-sm text-center opacity-80 mb-4">Добавьте ещё один аккаунт — он появится в меню.</p>}
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
            type="password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 focus:border-white/40 focus:outline-none transition-colors"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Вход…' : 'Войти'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm opacity-80">
          Нет аккаунта? <Link to={isAddAccount ? '/register?add=1' : '/register'} className="underline">Регистрация</Link>
        </p>
      </GlassPanel>
    </div>
  )
}
