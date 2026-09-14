import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, fmtTime } from '../api'
import { ErrorBox, Empty } from '../components/Bits'

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [events, setEvents] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    Promise.all([api.stats(), api.listEvents({ limit: 8 }), api.listDeliveries()])
      .then(([s, e, d]) => {
        setStats(s)
        setEvents(e.items)
        setDeliveries(d.items.slice(0, 8))
      })
      .catch(setError)
  }, [])

  return (
    <>
      <div className="head">
        <div>
          <h1>대시보드</h1>
          <p className="muted">최근 수신 현황과 메일 발송 결과입니다.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <div className="stats" style={{ marginBottom: 18 }}>
        {[
          ['엔드포인트', stats?.endpoints],
          ['24시간 수신', stats?.events_24h],
          ['7일 수신', stats?.events_7d],
          ['7일 메일 발송', stats?.sent_7d],
          ['7일 발송 실패', stats?.failed_7d],
        ].map(([label, n]) => (
          <div className="stat" key={label}>
            <div className="n">{n ?? '–'}</div>
            <div className="l">{label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <h2>
          최근 수신 <Link className="muted" to="/events">전체 보기 →</Link>
        </h2>
        {events.length === 0 ? (
          <Empty>아직 수신된 웹훅이 없습니다. 먼저 엔드포인트를 만드세요.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>엔드포인트</th>
                <th>메서드</th>
                <th>알림</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td className="mono">{fmtTime(e.received_at)}</td>
                  <td>{e.endpoint_name}</td>
                  <td className="mono">{e.method}</td>
                  <td>
                    {e.matched > 0 ? (
                      <span className="chip ok">{e.matched}건 발송</span>
                    ) : (
                      <span className="chip">해당 없음</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="panel">
        <h2>최근 메일 발송</h2>
        {deliveries.length === 0 ? (
          <Empty>발송 이력이 없습니다.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>시각</th>
                <th>수신자</th>
                <th>상태</th>
                <th>비고</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{fmtTime(d.created_at)}</td>
                  <td>{d.recipients}</td>
                  <td>
                    <span
                      className={
                        'chip ' + (d.status === 'sent' ? 'ok' : d.status === 'failed' ? 'bad' : 'warn')
                      }
                    >
                      {d.status === 'sent' ? '발송' : d.status === 'failed' ? '실패' : '제한'}
                    </span>
                  </td>
                  <td className="muted">{d.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
