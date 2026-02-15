import React from 'react'

/**
 * Reusable glassmorphism panel.
 * Use with Tailwind: className="glass-panel ..." for theme-aware glass.
 * Or pass custom className to override.
 */
export default function GlassPanel({ children, className = '', ...props }) {
  return (
    <div
      className={`glass-panel rounded-2xl ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
