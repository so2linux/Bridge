import React from 'react'
import { motion } from 'framer-motion'

/** Анимированная волна для голосового сообщения (placeholder) */
export default function VoiceWave({ playing = false, className = '' }) {
  const bars = 5
  return (
    <div className={`voice-wave flex items-end gap-0.5 h-6 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-indigo-400 min-h-[4px]"
          animate={
            playing
              ? {
                  scaleY: [0.4, 1, 0.6, 1, 0.4],
                  transition: {
                    duration: 1.2,
                    repeat: Infinity,
                    delay: i * 0.1,
                  },
                }
              : { scaleY: 0.4 }
          }
          style={{ transformOrigin: 'bottom' }}
        />
      ))}
    </div>
  )
}
