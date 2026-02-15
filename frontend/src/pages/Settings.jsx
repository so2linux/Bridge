import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../contexts/ThemeContext'
import { useAuth } from '../contexts/AuthContext'
import { THEMES } from '../contexts/ThemeContext'
import GlassPanel from '../components/GlassPanel'

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } }
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }

export default function Settings() {
  const navigate = useNavigate()
  const { theme, setTheme, themes } = useTheme()
  const { user, logout, logoutAll, fetchWithAuth, refreshUser } = useAuth()
  const [hideEmailSaving, setHideEmailSaving] = useState(false)

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="p-4 space-y-4">
      <GlassPanel className="p-5">
        <h2 className="text-lg font-semibold mb-4">Настройки</h2>
        <motion.div variants={item} className="space-y-4">
          <section>
            <p className="text-sm font-medium opacity-80 mb-2">Тема</p>
            <div className="flex gap-2">
              {[
                { key: themes.LIGHT, label: 'Светлая (молочная)' },
                { key: themes.DARK, label: 'Тёмная (синяя)' },
                { key: themes.OLED, label: 'OLED (чёрная)' },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`px-4 py-2 rounded-xl text-sm transition-colors ${theme === key ? 'bg-white/25' : 'bg-white/10 hover:bg-white/15'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>
          <section>
            <p className="text-sm font-medium opacity-80 mb-2">Уведомления</p>
            <p className="text-sm opacity-70">Включить уведомления о новых сообщениях (скоро)</p>
          </section>
          <section>
            <p className="text-sm font-medium opacity-80 mb-2">Конфиденциальность</p>
            <div className="flex items-center justify-between gap-3 py-2">
              <span className="text-sm opacity-90">Скрыть почту от других</span>
              <button
                type="button"
                disabled={hideEmailSaving}
                onClick={async () => {
                  const next = !user?.hide_email
                  setHideEmailSaving(true)
                  try {
                    const res = await fetchWithAuth('/users/me', {
                      method: 'PATCH',
                      body: JSON.stringify({ hide_email: next }),
                    })
                    if (res.ok) await refreshUser()
                  } finally {
                    setHideEmailSaving(false)
                  }
                }}
                className={`relative w-12 h-7 rounded-full transition-colors ${user?.hide_email ? 'bg-indigo-500' : 'bg-white/20'}`}
                aria-pressed={user?.hide_email}
              >
                <span
                  className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${user?.hide_email ? 'left-6' : 'left-1'}`}
                />
              </button>
            </div>
            <p className="text-xs opacity-60 mt-1">В поиске и у контактов будет отображаться только @username или имя, без email</p>
          </section>
          <section>
            <p className="text-sm font-medium opacity-80 mb-2">Сессии</p>
            <p className="text-sm opacity-70">Управление активными сессиями (скоро)</p>
          </section>
        </motion.div>
      </GlassPanel>
      {user && (
        <GlassPanel className="p-5">
          <p className="text-sm font-medium opacity-80 mb-2">Выход</p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => { logout(); navigate('/') }}
              className="flex-1 py-2 rounded-xl border border-white/20 hover:bg-white/10 text-sm"
            >
              Выйти из текущего
            </button>
            <button
              type="button"
              onClick={() => { logoutAll(); navigate('/login') }}
              className="flex-1 py-2 rounded-xl border border-red-400/40 text-red-400 hover:bg-red-400/10 text-sm"
            >
              Выйти из всех аккаунтов
            </button>
          </div>
        </GlassPanel>
      )}
    </motion.div>
  )
}
