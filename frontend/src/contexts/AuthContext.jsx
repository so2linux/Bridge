import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'

const AuthContext = createContext(null)
// Если фронт не через Vite proxy — задай в .env: VITE_API_URL=http://localhost:8000
const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '') + '/api/v1'
const ACCOUNTS_KEY = 'bridge_accounts'
const MAX_ACCOUNTS = 3

function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveAccounts(accounts) {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts.slice(0, MAX_ACCOUNTS)))
}

export function AuthProvider({ children }) {
  const [accounts, setAccountsState] = useState(loadAccounts)
  const [currentId, setCurrentId] = useState(() => {
    const list = loadAccounts()
    return list[0]?.user?.id ?? null
  })

  const currentAccount = accounts.find((a) => a.user?.id === currentId)
  const token = currentAccount?.token ?? null
  const user = currentAccount?.user ?? null

  const setAccounts = useCallback((next) => {
    setAccountsState(next)
    saveAccounts(next)
  }, [])

  const fetchWithAuth = useCallback(async (path, options = {}) => {
    const t = token || currentAccount?.token
    const headers = { ...options.headers }
    if (t) headers.Authorization = `Bearer ${t}`
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json'
    const res = await fetch(`${API}${path}`, { ...options, headers })
    if (res.status === 401 && currentId) {
      setAccountsState((prev) => {
        const next = prev.filter((a) => a.user?.id !== currentId)
        saveAccounts(next)
        return next
      })
      setCurrentId(loadAccounts()[0]?.user?.id ?? null)
    }
    return res
  }, [token, currentId, currentAccount])

  const login = useCallback(async (email, password) => {
    let res
    try {
      res = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
    } catch (e) {
      throw new Error('Не удалось подключиться к серверу. Запущен ли бэкенд на порту 8000?')
    }
    const text = await res.text()
    let d = {}
    try {
      d = text ? JSON.parse(text) : {}
    } catch (_) {
      throw new Error(res.ok ? 'Неверный ответ сервера' : `Ошибка входа (${res.status})`)
    }
    if (!res.ok) {
      const detail = d.detail
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) && detail.length ? detail.map((x) => x.msg || x.message).filter(Boolean).join('. ') : `Ошибка входа (${res.status})`
      throw new Error(msg)
    }
    if (!d.access_token || !d.user || !d.user.id) {
      throw new Error('Неверный ответ сервера: нет токена или пользователя')
    }
    const acc = { token: d.access_token, user: d.user }
    setAccountsState((prev) => {
      const rest = prev.filter((a) => a.user?.id !== d.user.id)
      const next = [acc, ...rest].slice(0, MAX_ACCOUNTS)
      saveAccounts(next)
      return next
    })
    setCurrentId(d.user.id)
    return d
  }, [])

  const register = useCallback(async (email, password, display_name = '', username = '') => {
    let res
    try {
      res = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, display_name, username: username || undefined }),
      })
    } catch (e) {
      throw new Error('Не удалось подключиться к серверу. Запущен ли бэкенд на порту 8000?')
    }
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      const detail = d.detail
      const msg = typeof detail === 'string' ? detail : (Array.isArray(detail) && detail.length ? detail.map((x) => x.msg || x.message).filter(Boolean).join('. ') : null) || `Ошибка регистрации (${res.status})`
      throw new Error(msg || 'Ошибка регистрации')
    }
    const data = await res.json()
    const acc = { token: data.access_token, user: data.user }
    setAccountsState((prev) => {
      const rest = prev.filter((a) => a.user?.id !== data.user.id)
      const next = [acc, ...rest].slice(0, MAX_ACCOUNTS)
      saveAccounts(next)
      return next
    })
    setCurrentId(data.user.id)
    return data
  }, [])

  const logout = useCallback(() => {
    setAccountsState((prev) => prev.filter((a) => a.user?.id !== currentId))
    const rest = loadAccounts().filter((a) => a.user?.id !== currentId)
    saveAccounts(rest)
    setCurrentId(rest[0]?.user?.id ?? null)
  }, [currentId])

  const logoutAll = useCallback(() => {
    setAccountsState([])
    setCurrentId(null)
    saveAccounts([])
  }, [])

  const setCurrentAccount = useCallback((userId) => {
    if (accounts.some((a) => a.user?.id === userId)) setCurrentId(userId)
  }, [accounts])

  const refreshUser = useCallback(async () => {
    const t = token || currentAccount?.token
    if (!t) return
    const res = await fetch(`${API}/users/me`, {
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
    })
    if (res.ok) {
      const u = await res.json()
      setAccountsState((prev) => {
        const next = prev.map((a) => (a.user?.id === u.id ? { ...a, user: u } : a))
        saveAccounts(next)
        return next
      })
    }
  }, [token, currentAccount])

  useEffect(() => {
    if (token && user && !accounts.find((a) => a.user?.id === user.id)?.user?.updated_at) {
      refreshUser()
    }
  }, [token, user?.id])

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        accounts,
        currentId,
        setCurrentAccount,
        login,
        register,
        logout,
        logoutAll,
        fetchWithAuth,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
