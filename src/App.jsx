import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { configMissing, signIn, signOut, watchAuth } from './firebase'
import Dashboard from './pages/Dashboard'
import Endpoints from './pages/Endpoints'
import Events from './pages/Events'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import Guide from './pages/Guide'

const NAV = [
  ['/', '📊 대시보드'],
  ['/endpoints', '🔗 엔드포인트'],
  ['/events', '📥 수신 로그'],
  ['/rules', '🔔 알림 규칙'],
  ['/settings', '⚙️ 설정'],
  ['/guide', '📖 사용법'],
]

export default function App() {
  const [user, setUser] = useState(undefined)

  useEffect(() => watchAuth(setUser), [])

  if (configMissing.length)
    return (
      <div className="center">
        <div style={{ maxWidth: 460, textAlign: 'left' }}>
          <h1>설정이 빠졌습니다</h1>
          <p className="muted">
            빌드에 아래 환경변수가 들어가지 않아 로그인을 초기화할 수 없습니다. GitHub 저장소의
            Secrets/Variables를 확인하고 배포 워크플로를 다시 실행하세요.
          </p>
          <pre className="payload">{configMissing.join('\n')}</pre>
        </div>
      </div>
    )

  if (user === undefined) return <div className="center">불러오는 중…</div>

  if (!user)
    return (
      <div className="center">
        <div>
          <h1>웹훅 알림 허브</h1>
          <p className="muted" style={{ marginBottom: 20 }}>
            웹훅을 받아 조건에 맞으면 메일로 알려줍니다.
          </p>
          <button className="primary" onClick={() => signIn().catch((e) => alert(e.message))}>
            Google로 로그인
          </button>
        </div>
      </div>
    )

  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">웹훅 알림 허브</div>
        {NAV.map(([to, label]) => (
          <NavLink key={to} to={to} end={to === '/'}>
            {label}
          </NavLink>
        ))}
        <div className="foot">
          {user.email}
          <br />
          <button style={{ marginTop: 8 }} onClick={signOut}>
            로그아웃
          </button>
        </div>
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/endpoints" element={<Endpoints />} />
          <Route path="/events" element={<Events />} />
          <Route path="/rules" element={<Rules />} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
