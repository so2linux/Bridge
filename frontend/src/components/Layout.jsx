import React, { useState } from 'react'
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { THEMES } from '../contexts/ThemeContext'
import SearchModal from './SearchModal'

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
}

export default function Layout() {
  const { theme, setTheme, themes } = useTheme()
  const { user, accounts, currentId, setCurrentAccount, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [accountsExpanded, setAccountsExpanded] = useState(true)

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-50 glass-panel rounded-none border-x-0 border-t-0 flex items-center justify-between px-4 py-3 max-w-full md:max-w-4xl md:mx-auto w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            aria-label="Меню"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <Link to="/" className="text-xl font-semibold tracking-tight">
            Bridge
          </Link>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-200 hover:bg-amber-500/30 transition-colors text-sm font-medium"
              title="Баланс BRG — в профиле"
            >
              <span>{(user?.balance ?? 0).toFixed(2)}</span>
              <span className="opacity-90">BRG</span>
            </Link>
          )}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="p-2 rounded-xl hover:bg-white/10 transition-colors"
            aria-label="Поиск"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <div className="flex rounded-xl overflow-hidden border border-white/10 bg-black/10 p-0.5">
            {[
              { key: themes.LIGHT, label: '☀️', aria: 'Светлая' },
              { key: themes.DARK, label: '🌙', aria: 'Тёмная' },
              { key: themes.OLED, label: '⬛', aria: 'OLED' },
            ].map(({ key, label, aria }) => (
              <button
                key={key}
                type="button"
                aria-label={aria}
                title={aria}
                onClick={() => setTheme(key)}
                className={`px-2.5 py-1.5 text-sm rounded-lg transition-all duration-200 ${theme === key ? 'bg-white/30 shadow' : 'opacity-80 hover:bg-white/10'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2 }}
          className="flex-1 flex flex-col max-w-full md:max-w-4xl md:mx-auto w-full px-3 pb-24"
        >
          <Outlet />
        </motion.main>
      </AnimatePresence>

      {/* Sidebar: multi-account + nav */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
              onClick={() => setSidebarOpen(false)}
              aria-hidden
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 glass-panel rounded-r-2xl border-l border-white/10 z-50 flex flex-col p-4"
            >
              <div className="flex justify-between items-center mb-4">
                <span className="font-semibold">Меню</span>
                <button type="button" onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg hover:bg-white/10">
                  ✕
                </button>
              </div>
              {user && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setAccountsExpanded((e) => !e)}
                    className="w-full flex items-center justify-between text-xs opacity-70 mb-2 py-1 rounded-lg hover:bg-white/10"
                  >
                    <span>Аккаунты (до 3)</span>
                    <span className={`inline-block transition-transform ${accountsExpanded ? '' : '-rotate-90'}`}>▼</span>
                  </button>
                  {accountsExpanded && (
                    <div className="space-y-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.user?.id}
                          type="button"
                          onClick={() => {
                            setCurrentAccount(acc.user?.id)
                            setSidebarOpen(false)
                            navigate('/', { replace: true })
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                            acc.user?.id === currentId ? 'bg-white/20' : 'hover:bg-white/10'
                          }`}
                        >
                          <div className="w-9 h-9 rounded-full bg-indigo-500/50 flex items-center justify-center text-sm font-medium">
                            {(acc.user?.display_name || acc.user?.username || acc.user?.email || '?').slice(0, 1).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-sm">
                              {acc.user?.display_name || acc.user?.username || `@${acc.user?.username || 'user'}` || acc.user?.email}
                            </p>
                            <p className="truncate text-xs opacity-70">{acc.user?.email}</p>
                          </div>
                        </button>
                      ))}
                      {accounts.length < 3 && (
                        <Link
                          to="/login?add=1"
                          onClick={() => setSidebarOpen(false)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl text-left border border-dashed border-white/30 hover:bg-white/10 text-sm"
                        >
                          <span className="text-lg">+</span>
                          <span>Добавить аккаунт</span>
                        </Link>
                      )}
                    </div>
                  )}
                </div>
              )}
              <nav className="flex-1 flex flex-col gap-1">
                <Link to="/" onClick={() => setSidebarOpen(false)} className={`p-3 rounded-xl flex items-center gap-3 ${location.pathname === '/' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  💬 Чаты
                </Link>
                <Link to="/stories" onClick={() => setSidebarOpen(false)} className="p-3 rounded-xl flex items-center gap-3 hover:bg-white/10">
                  📖 Stories
                </Link>
                <Link to="/profile" onClick={() => setSidebarOpen(false)} className={`p-3 rounded-xl flex items-center gap-3 ${location.pathname === '/profile' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  👤 Профиль
                </Link>
                <Link to="/settings" onClick={() => setSidebarOpen(false)} className={`p-3 rounded-xl flex items-center gap-3 ${location.pathname === '/settings' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                  ⚙️ Настройки
                </Link>
                {user?.email === 'tfamilia816@gmail.com' && (
                  <Link to="/admin" onClick={() => setSidebarOpen(false)} className={`p-3 rounded-xl flex items-center gap-3 ${location.pathname === '/admin' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
                    🛡️ Админ
                  </Link>
                )}
              </nav>
              {user && (
                <button
                  type="button"
                  onClick={() => { logout(); setSidebarOpen(false); navigate('/login') }}
                  className="mt-auto p-3 rounded-xl border border-red-400/30 text-red-400 hover:bg-red-400/10 text-sm"
                >
                  Выйти из аккаунта
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-30 glass-panel rounded-none border-t border-white/10 md:max-w-4xl md:left-1/2 md:-translate-x-1/2 flex justify-around py-2">
        <Link to="/" className={`flex flex-col items-center py-2 px-4 rounded-xl ${location.pathname === '/' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className="text-xl">💬</span>
          <span className="text-xs mt-0.5">Чаты</span>
        </Link>
        <Link to="/stories" className={`flex flex-col items-center py-2 px-4 rounded-xl ${location.pathname === '/stories' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className="text-xl">📖</span>
          <span className="text-xs mt-0.5">Stories</span>
        </Link>
        <Link to="/profile" className={`flex flex-col items-center py-2 px-4 rounded-xl ${location.pathname === '/profile' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className="text-xl">👤</span>
          <span className="text-xs mt-0.5">Профиль</span>
        </Link>
        <Link to="/settings" className={`flex flex-col items-center py-2 px-4 rounded-xl ${location.pathname === '/settings' ? 'bg-white/20' : 'hover:bg-white/10'}`}>
          <span className="text-xl">⚙️</span>
          <span className="text-xs mt-0.5">Настройки</span>
        </Link>
      </nav>
    </div>
  )
}
