import { useEffect, useState } from 'react'
import { api, fmtTime, ingestUrl } from '../api'
import { CopyButton, Empty, ErrorBox } from '../components/Bits'

export default function Endpoints() {
  const [items, setItems] = useState([])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', secret: '', sig_header: '' })
  const [editing, setEditing] = useState(null)

  const load = () =>
    api
      .listEndpoints()
      .then((r) => setItems(r.items))
      .catch(setError)

  useEffect(() => {
    load()
  }, [])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api.createEndpoint(form)
      setForm({ name: '', secret: '', sig_header: '' })
      await load()
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }

  async function act(fn) {
    setError(null)
    try {
      await fn()
      await load()
    } catch (err) {
      setError(err)
    }
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>엔드포인트</h1>
          <p className="muted">발급된 URL을 외부 시스템의 웹훅 주소로 등록하세요.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <form className="panel" onSubmit={create}>
        <h2>새 엔드포인트</h2>
        <div className="row">
          <div className="field">
            <label>이름 *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: GitHub 배포 알림"
              required
            />
          </div>
          <div className="field">
            <label>서명 시크릿 (선택)</label>
            <input
              value={form.secret}
              onChange={(e) => setForm({ ...form, secret: e.target.value })}
              placeholder="HMAC-SHA256 검증용"
            />
          </div>
          <div className="field">
            <label>서명 헤더 (선택)</label>
            <input
              value={form.sig_header}
              onChange={(e) => setForm({ ...form, sig_header: e.target.value })}
              placeholder="X-Hub-Signature-256"
            />
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <button className="primary" disabled={busy}>
              만들기
            </button>
          </div>
        </div>
        <p className="muted">
          시크릿과 헤더를 모두 채우면 서명이 맞지 않는 요청은 401로 거부하고 알림도 보내지 않습니다.
        </p>
      </form>

      {items.length === 0 ? (
        <div className="panel">
          <Empty>등록된 엔드포인트가 없습니다.</Empty>
        </div>
      ) : (
        items.map((ep) => {
          const url = ingestUrl(ep.token)
          const isEditing = editing === ep.id
          return (
            <div className="panel" key={ep.id}>
              <div className="head" style={{ marginBottom: 10 }}>
                <div>
                  <h2 style={{ marginBottom: 2 }}>
                    {ep.name} {ep.paused ? <span className="chip warn">중지됨</span> : null}
                  </h2>
                  <span className="muted">
                    수신 {ep.event_count}건 · 마지막 {fmtTime(ep.last_event)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => setEditing(isEditing ? null : ep.id)}>
                    {isEditing ? '닫기' : '수정'}
                  </button>
                  <button
                    onClick={() => act(() => api.updateEndpoint(ep.id, { paused: !ep.paused }))}
                  >
                    {ep.paused ? '재개' : '중지'}
                  </button>
                  <button
                    className="danger"
                    onClick={() => {
                      if (confirm(`"${ep.name}" 엔드포인트와 수신 로그를 모두 삭제할까요?`))
                        act(() => api.deleteEndpoint(ep.id))
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>

              <div className="row" style={{ alignItems: 'center' }}>
                <input className="mono" readOnly value={url} onFocus={(e) => e.target.select()} />
                <div style={{ flex: '0 0 auto', display: 'flex', gap: 6 }}>
                  <CopyButton text={url} label="URL 복사" />
                  <button
                    onClick={() => {
                      if (confirm('토큰을 재발급하면 기존 URL은 즉시 무효가 됩니다. 계속할까요?'))
                        act(() => api.rotateToken(ep.id))
                    }}
                  >
                    토큰 재발급
                  </button>
                </div>
              </div>

              {isEditing && (
                <EditForm
                  ep={ep}
                  onSave={async (patch) => {
                    await act(() => api.updateEndpoint(ep.id, patch))
                    setEditing(null)
                  }}
                />
              )}
            </div>
          )
        })
      )}
    </>
  )
}

function EditForm({ ep, onSave }) {
  const [v, setV] = useState({
    name: ep.name,
    secret: ep.secret || '',
    sig_header: ep.sig_header || '',
  })
  return (
    <div className="row" style={{ marginTop: 14 }}>
      <div className="field">
        <label>이름</label>
        <input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
      </div>
      <div className="field">
        <label>서명 시크릿</label>
        <input value={v.secret} onChange={(e) => setV({ ...v, secret: e.target.value })} />
      </div>
      <div className="field">
        <label>서명 헤더</label>
        <input value={v.sig_header} onChange={(e) => setV({ ...v, sig_header: e.target.value })} />
      </div>
      <div className="field" style={{ flex: '0 0 auto' }}>
        <button className="primary" onClick={() => onSave(v)}>
          저장
        </button>
      </div>
    </div>
  )
}
