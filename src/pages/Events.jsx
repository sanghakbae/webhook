import { useEffect, useState } from 'react'
import { api, fmtTime } from '../api'
import { CopyButton, Empty, ErrorBox } from '../components/Bits'

export default function Events() {
  const [items, setItems] = useState([])
  const [endpoints, setEndpoints] = useState([])
  const [filter, setFilter] = useState({ endpoint: '', matched: '' })
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [done, setDone] = useState(false)

  useEffect(() => {
    api.listEndpoints().then((r) => setEndpoints(r.items)).catch(setError)
  }, [])

  const load = (before) => {
    setLoading(true)
    api
      .listEvents({ ...filter, before, limit: 50 })
      .then((r) => {
        setItems((prev) => (before ? [...prev, ...r.items] : r.items))
        setDone(r.items.length < 50)
      })
      .catch(setError)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setItems([])
    load(undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.endpoint, filter.matched])

  const open = (id) => {
    setDetail({ loading: true })
    api.getEvent(id).then(setDetail).catch(setError)
  }

  return (
    <>
      <div className="head">
        <div>
          <h1>수신 로그</h1>
          <p className="muted">받은 요청의 헤더·본문 원문과 메일 발송 결과를 확인합니다.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <div className="panel">
        <div className="row">
          <div className="field">
            <label>엔드포인트</label>
            <select
              value={filter.endpoint}
              onChange={(e) => setFilter({ ...filter, endpoint: e.target.value })}
            >
              <option value="">전체</option>
              {endpoints.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>알림 발송</label>
            <select
              value={filter.matched}
              onChange={(e) => setFilter({ ...filter, matched: e.target.value })}
            >
              <option value="">전체</option>
              <option value="1">발송된 것만</option>
            </select>
          </div>
          <div className="field" style={{ flex: '0 0 auto' }}>
            <button onClick={() => load(undefined)}>새로고침</button>
          </div>
        </div>

        {items.length === 0 && !loading ? (
          <Empty>수신된 요청이 없습니다.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>엔드포인트</th>
                <th>메서드</th>
                <th>서명</th>
                <th>알림</th>
                <th className="remark">본문 미리보기</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="clickable" onClick={() => open(e.id)}>
                  <td className="mono">{fmtTime(e.received_at)}</td>
                  <td>{e.endpoint_name}</td>
                  <td className="mono">{e.method}</td>
                  <td>
                    {e.sig_ok === null ? (
                      <span className="muted">–</span>
                    ) : e.sig_ok ? (
                      <span className="chip ok">통과</span>
                    ) : (
                      <span className="chip bad">실패</span>
                    )}
                  </td>
                  <td>{e.matched > 0 ? <span className="chip ok">{e.matched}</span> : '–'}</td>
                  <td className="remark mono muted" style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {e.preview}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!done && items.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button disabled={loading} onClick={() => load(items[items.length - 1].received_at)}>
              {loading ? '불러오는 중…' : '더 보기'}
            </button>
          </div>
        )}
      </div>

      {detail && <EventDetail detail={detail} onClose={() => setDetail(null)} onError={setError} />}
    </>
  )
}

function EventDetail({ detail, onClose, onError }) {
  const [msg, setMsg] = useState('')
  if (detail.loading) return <div className="panel">불러오는 중…</div>

  let pretty = detail.body
  try {
    pretty = JSON.stringify(JSON.parse(detail.body), null, 2)
  } catch {}

  let headers = detail.headers
  try {
    headers = JSON.stringify(JSON.parse(detail.headers || '{}'), null, 2)
  } catch {}

  return (
    <div className="panel">
      <div className="head" style={{ marginBottom: 10 }}>
        <div>
          <h2 style={{ marginBottom: 2 }}>{detail.endpoint_name}</h2>
          <span className="muted mono">{fmtTime(detail.received_at)} · {detail.source_ip || 'IP 없음'}</span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <CopyButton text={detail.body || ''} label="본문 복사" />
          <button
            onClick={async () => {
              setMsg('')
              try {
                const r = await api.resendEvent(detail.id)
                setMsg(`메일 재발송 요청 완료 (${r.count}개 규칙)`)
              } catch (e) {
                onError(e)
              }
            }}
          >
            메일 재발송
          </button>
          <button onClick={onClose}>닫기</button>
        </div>
      </div>
      {msg && <div className="notice">{msg}</div>}

      <div className="field">
        <label>본문</label>
        <pre className="payload">{pretty || '(본문 없음)'}</pre>
      </div>
      <div className="field">
        <label>헤더</label>
        <pre className="payload" style={{ maxHeight: 220 }}>
          {headers}
        </pre>
      </div>

      <div className="field">
        <label>메일 발송 이력</label>
        {detail.deliveries.length === 0 ? (
          <span className="muted">없음</span>
        ) : (
          <table>
            <tbody>
              {detail.deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{fmtTime(d.created_at)}</td>
                  <td>{d.recipients}</td>
                  <td>
                    <span className={'chip ' + (d.status === 'sent' ? 'ok' : d.status === 'failed' ? 'bad' : 'warn')}>
                      {d.status}
                    </span>
                  </td>
                  <td className="remark muted">{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
