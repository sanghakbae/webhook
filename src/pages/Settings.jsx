import { useEffect, useState } from 'react'
import { api, WORKER_BASE } from '../api'
import { ErrorBox } from '../components/Bits'

export default function Settings({ user }) {
  const [cfg, setCfg] = useState({ mail_to: '', mail_from: '' })
  const [msg, setMsg] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api.config().then(setCfg).catch(setError)
  }, [])

  async function test() {
    setBusy(true)
    setMsg('')
    setError(null)
    try {
      const r = await api.testEmail()
      setMsg(`발송 완료${r.detail ? ` (id: ${r.detail})` : ''}. 받은편지함을 확인하세요.`)
    } catch (e) {
      setError(e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>설정</h1>
          <p className="muted">메일 발송이 제대로 되는지 확인합니다.</p>
        </div>
      </div>
      <ErrorBox error={error} />
      {msg && <div className="notice">{msg}</div>}

      <div className="panel">
        <h2>테스트 메일</h2>
        <div className="row">
          <div className="field">
            <label>받는 주소 (고정)</label>
            <input className="mono" value={cfg.mail_to} readOnly />
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <button className="primary" disabled={busy} onClick={test}>
              {busy ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </div>
        <p className="muted">
          이 시스템의 모든 알림은 위 주소로만 발송됩니다. 규칙마다 다른 주소를 지정할 수 없습니다.
        </p>
      </div>

      <div className="panel">
        <h2>연결 정보</h2>
        <table>
          <tbody>
            <tr>
              <td>로그인 계정</td>
              <td className="mono">{user.email}</td>
            </tr>
            <tr>
              <td>Worker 주소</td>
              <td className="mono">{WORKER_BASE || '(같은 오리진 · 로컬 개발)'}</td>
            </tr>
            <tr>
              <td>발신 주소</td>
              <td className="mono">{cfg.mail_from || '-'}</td>
            </tr>
            <tr>
              <td>수신 주소 (고정)</td>
              <td className="mono">{cfg.mail_to || '-'}</td>
            </tr>
            <tr>
              <td>Firebase 프로젝트</td>
              <td className="mono">{import.meta.env.VITE_FIREBASE_PROJECT_ID || '-'}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          접근 허용 계정·수신 주소·보관 기간은 Worker의 <code>ALLOWED_EMAILS</code>,{' '}
          <code>MAIL_TO</code>, <code>EVENT_RETENTION_DAYS</code> 변수로 관리합니다.
        </p>
      </div>
    </>
  )
}
