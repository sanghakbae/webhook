import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { configMissing, signIn, signOut, watchAuth } from './firebase'
import Dashboard from './pages/Dashboard'
import Endpoints from './pages/Endpoints'
import Events from './pages/Events'
import Rules from './pages/Rules'
import Settings from './pages/Settings'
import Guide from './pages/Guide'

// 모바일 하단 탭은 6칸을 한 줄에 나눠 쓴다. 라벨이 접히면 안 되므로 짧은 이름을 따로 둔다.
const NAV = [
  ['/', '📊', '대시보드', '대시보드'],
  ['/endpoints', '🔗', '엔드포인트', '엔드포인트'],
  ['/events', '📥', '수신 로그', '로그'],
  ['/rules', '🔔', '알림 규칙', '규칙'],
  ['/settings', '⚙️', '설정', '설정'],
  ['/guide', '📖', '사용법', '사용법'],
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
        <div className="login-card">
          <div style={{ fontSize: 34, marginBottom: 10 }}>🔔</div>
          <h1>웹훅 알림 허브</h1>
          <p className="muted" style={{ marginBottom: 24 }}>
            웹훅을 받아 조건에 맞으면 메일로 알려줍니다.
          </p>
          <button
            className="primary"
            style={{ width: '100%', padding: '10px 16px' }}
            onClick={() => signIn().catch((e) => alert(e.message))}
          >
            Google로 로그인
          </button>
        </div>
      </div>
    )

  return (
    <div className="shell">
      <header className="topbar">
        <span className="topbar-brand">🔔 웹훅 알림 허브</span>
        <button className="sm" onClick={signOut}>
          로그아웃
        </button>
      </header>

      <nav className="side">
        <div className="brand">🔔 웹훅 알림 허브</div>
        {NAV.map(([to, icon, label, short]) => (
          <NavLink key={to} to={to} end={to === '/'} title={label}>
            <span className="nav-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="nav-label">{label}</span>
            <span className="nav-label-short" aria-hidden="true">
              {short}
            </span>
          </NavLink>
        ))}
        <div className="foot">
          {user.email}
          <br />
          <button className="sm" style={{ marginTop: 10 }} onClick={signOut}>
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
