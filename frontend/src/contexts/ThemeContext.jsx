import React, { createContext, useContext, useState, useEffect } from 'react'

const THEMES = {
  LIGHT: 'light',
  DARK: 'dark',
  OLED: 'oled',
}

const ThemeContext = createContext({
  theme: THEMES.DARK,
  setTheme: () => {},
  themes: THEMES,
})

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.localStorage.getItem('bridge-theme') || THEMES.DARK
    }
    return THEMES.DARK
  })

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-light', 'theme-dark', 'theme-oled')
    root.classList.add(`theme-${theme}`)
    root.setAttribute('data-theme', theme)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('bridge-theme', theme)
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) {
        const colors = { light: '#faf9f7', dark: '#0c1222', oled: '#000000' }
        meta.setAttribute('content', colors[theme] || colors.dark)
      }
    }
  }, [theme])

  const setTheme = (newTheme) => {
    if (Object.values(THEMES).includes(newTheme)) {
      setThemeState(newTheme)
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return ctx
}

export { THEMES }
