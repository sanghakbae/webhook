import { useState } from 'react'

export function ErrorBox({ error }) {
  if (!error) return null
  return <div className="error">{String(error.message || error)}</div>
}

export function Notice({ children }) {
  if (!children) return null
  return <div className="notice">{children}</div>
}

export function CopyButton({ text, label = '복사' }) {
  const [done, setDone] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setDone(true)
          setTimeout(() => setDone(false), 1500)
        } catch {
          alert('복사에 실패했습니다. 직접 선택해 복사해 주세요.')
        }
      }}
    >
      {done ? '복사됨 ✓' : label}
    </button>
  )
}

export function Empty({ children }) {
  return (
    <div className="muted" style={{ padding: '28px 0', textAlign: 'center' }}>
      {children}
    </div>
  )
}
