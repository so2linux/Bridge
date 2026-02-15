import React, { useRef, useState, useEffect } from 'react'

export default function VoicePlayer({ url }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)

  const fullUrl = url?.startsWith('http') ? url : `${window.location.origin}${url}`

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTimeUpdate = () => setProgress(el.currentTime)
    const onDurationChange = () => setDuration(el.duration)
    const onEnded = () => { setPlaying(false); setProgress(0) }
    el.addEventListener('timeupdate', onTimeUpdate)
    el.addEventListener('durationchange', onDurationChange)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTimeUpdate)
      el.removeEventListener('durationchange', onDurationChange)
      el.removeEventListener('ended', onEnded)
    }
  }, [url])

  const toggle = () => {
    const el = audioRef.current
    if (!el) return
    if (playing) {
      el.pause()
    } else {
      el.play()
    }
    setPlaying(!playing)
  }

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={fullUrl} preload="metadata" />
      <button
        type="button"
        onClick={toggle}
        className="w-8 h-8 rounded-full bg-indigo-500/80 flex items-center justify-center text-white text-sm hover:bg-indigo-500"
      >
        {playing ? '⏸' : '▶'}
      </button>
      <div className="flex-1 flex flex-col gap-0.5">
        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
          <div
            className="h-full bg-indigo-400/80 rounded-full transition-all"
            style={{ width: duration ? `${(progress / duration) * 100}%` : '0%' }}
          />
        </div>
        <span className="text-xs opacity-70">
          {Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')}
          {duration ? ` / ${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}` : ''}
        </span>
      </div>
    </div>
  )
}
