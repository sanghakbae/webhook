import { useState } from 'react'
import { api, WORKER_BASE } from '../api'
import { ErrorBox } from '../components/Bits'

export default function Settings({ user }) {
  const [to, setTo] = useState('bae@sanghak.kr')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function test() {
    setBusy(true)
    setMsg('')
    setError(null)
    try {
      const r = await api.testEmail(to)
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
            <label>받는 주소 (콤마로 여러 개)</label>
            <input value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <button className="primary" disabled={busy} onClick={test}>
              {busy ? '보내는 중…' : '보내기'}
            </button>
          </div>
        </div>
        <p className="muted">
          실패하면 Worker에 <code>RESEND_API_KEY</code> 시크릿이 설정됐는지, <code>MAIL_FROM</code> 도메인이
          Resend에 인증됐는지 확인하세요.
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
              <td>Firebase 프로젝트</td>
              <td className="mono">{import.meta.env.VITE_FIREBASE_PROJECT_ID || '-'}</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          접근 허용 계정과 보관 기간은 Worker의 <code>ALLOWED_EMAILS</code>,{' '}
          <code>EVENT_RETENTION_DAYS</code> 변수로 관리합니다.
        </p>
      </div>
    </>
  )
}
