import { useEffect, useState } from 'react'
import { api } from '../api'
import { Empty, ErrorBox } from '../components/Bits'

const EMPTY = {
  name: '',
  endpoint_id: '',
  match_type: 'always',
  field: '',
  op: 'eq',
  value: '',
  subject_tpl: '[웹훅] {{endpoint}}',
  body_tpl: '',
  throttle_s: 0,
  enabled: true,
}

const OPS = [
  ['eq', '같음'],
  ['ne', '다름'],
  ['contains', '포함'],
  ['gt', '초과'],
  ['lt', '미만'],
  ['exists', '값이 있음'],
]

export default function Rules() {
  const [items, setItems] = useState([])
  const [endpoints, setEndpoints] = useState([])
  const [mailTo, setMailTo] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [editId, setEditId] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = () =>
    Promise.all([api.listRules(), api.listEndpoints(), api.config()])
      .then(([r, e, c]) => {
        setItems(r.items)
        setEndpoints(e.items)
        setMailTo(c.mail_to)
      })
      .catch(setError)

  useEffect(() => {
    load()
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const body = { ...form, throttle_s: Number(form.throttle_s || 0) }
      if (editId) await api.updateRule(editId, body)
      else await api.createRule(body)
      setForm(EMPTY)
      setEditId(null)
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

  const epName = (id) => endpoints.find((e) => e.id === id)?.name || '전체'

  return (
    <>
      <div className="head">
        <div>
          <h1>알림 규칙</h1>
          <p className="muted">조건에 맞는 웹훅이 들어오면 지정한 주소로 메일을 보냅니다.</p>
        </div>
      </div>
      <ErrorBox error={error} />

      <form className="panel" onSubmit={submit}>
        <h2>{editId ? '규칙 수정' : '새 규칙'}</h2>
        <div className="row">
          <div className="field">
            <label>규칙 이름 *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 배포 실패 알림"
              required
            />
          </div>
          <div className="field">
            <label>대상 엔드포인트</label>
            <select
              value={form.endpoint_id}
              onChange={(e) => setForm({ ...form, endpoint_id: e.target.value })}
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
            <label>조건 종류</label>
            <select
              value={form.match_type}
              onChange={(e) => setForm({ ...form, match_type: e.target.value })}
            >
              <option value="always">항상 (모든 요청)</option>
              <option value="jsonpath">JSON 필드 조건</option>
              <option value="contains">본문 문자열 포함</option>
            </select>
          </div>
        </div>

        {form.match_type === 'jsonpath' && (
          <div className="row">
            <div className="field">
              <label>필드 경로</label>
              <input
                className="mono"
                value={form.field}
                onChange={(e) => setForm({ ...form, field: e.target.value })}
                placeholder="예: workflow_run.conclusion (배열은 items.0.id)"
              />
            </div>
            <div className="field" style={{ flex: '0 1 130px' }}>
              <label>비교</label>
              <select value={form.op} onChange={(e) => setForm({ ...form, op: e.target.value })}>
                {OPS.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            {form.op !== 'exists' && (
              <div className="field">
                <label>값</label>
                <input
                  value={form.value}
                  onChange={(e) => setForm({ ...form, value: e.target.value })}
                  placeholder="failure"
                />
              </div>
            )}
          </div>
        )}

        {form.match_type === 'contains' && (
          <div className="field">
            <label>본문에 포함될 문자열</label>
            <input
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              placeholder="예: ERROR"
            />
          </div>
        )}

        <div className="row">
          <div className="field">
            <label>수신 메일</label>
            <input className="mono" value={mailTo} readOnly title="시스템 전역 설정으로 고정된 주소입니다" />
          </div>
          <div className="field">
            <label>제목 템플릿</label>
            <input
              className="mono"
              value={form.subject_tpl}
              onChange={(e) => setForm({ ...form, subject_tpl: e.target.value })}
              placeholder="[웹훅] {{endpoint}}"
            />
          </div>
          <div className="field" style={{ flex: '0 1 150px' }}>
            <label>최소 간격(초)</label>
            <input
              type="number"
              min="0"
              value={form.throttle_s}
              onChange={(e) => setForm({ ...form, throttle_s: e.target.value })}
            />
          </div>
        </div>
        <div className="field">
          <label>본문 템플릿 (비우면 받은 데이터 원문을 그대로 싣습니다)</label>
          <textarea
            rows={4}
            className="mono"
            value={form.body_tpl}
            onChange={(e) => setForm({ ...form, body_tpl: e.target.value })}
            placeholder={'{{title}}\n\n{{text}}'}
          />
        </div>

        <p className="muted" style={{ marginTop: 0 }}>
          알림은 <b>{mailTo || '설정된 주소'}</b> 로만 발송됩니다. 바꾸려면 Worker의 <code>MAIL_TO</code>
          변수를 수정하세요. 제목에 <code>{'{{endpoint}}'}</code>, <code>{'{{rule}}'}</code>, <code>{'{{time}}'}</code> 과
          JSON 필드 경로(<code>{'{{repository.name}}'}</code>)를 쓸 수 있습니다. 최소 간격은 같은 규칙이
          연달아 터질 때 메일 폭탄을 막아줍니다.
        </p>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="primary" disabled={busy}>
            {editId ? '저장' : '규칙 추가'}
          </button>
          {editId && (
            <button
              type="button"
              onClick={() => {
                setEditId(null)
                setForm(EMPTY)
              }}
            >
              취소
            </button>
          )}
        </div>
      </form>

      <div className="panel">
        <h2>등록된 규칙</h2>
        {items.length === 0 ? (
          <Empty>규칙이 없습니다. 규칙이 하나도 없으면 메일은 발송되지 않습니다.</Empty>
        ) : (
          <table>
            <thead>
              <tr>
                <th>이름</th>
                <th>대상</th>
                <th>조건</th>
                <th>본문</th>
                <th>간격</th>
                <th>상태</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{epName(r.endpoint_id)}</td>
                  <td className="mono muted">
                    {r.match_type === 'always'
                      ? '항상'
                      : r.match_type === 'contains'
                        ? `본문 ⊃ "${r.value}"`
                        : `${r.field} ${r.op} ${r.op === 'exists' ? '' : r.value}`}
                  </td>
                  <td className="muted">{r.body_tpl ? '템플릿' : '원문'}</td>
                  <td className="muted">{r.throttle_s ? `${r.throttle_s}s` : '–'}</td>
                  <td>
                    <span className={'chip ' + (r.enabled ? 'ok' : '')}>
                      {r.enabled ? '켜짐' : '꺼짐'}
                    </span>
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button onClick={() => act(() => api.updateRule(r.id, { enabled: !r.enabled }))}>
                      {r.enabled ? '끄기' : '켜기'}
                    </button>{' '}
                    <button
                      onClick={() => {
                        setEditId(r.id)
                        setForm({
                          ...r,
                          recipients: undefined,
                          endpoint_id: r.endpoint_id || '',
                          field: r.field || '',
                          op: r.op || 'eq',
                          value: r.value ?? '',
                          subject_tpl: r.subject_tpl || '',
                          body_tpl: r.body_tpl || '',
                          enabled: !!r.enabled,
                        })
                        window.scrollTo({ top: 0, behavior: 'smooth' })
                      }}
                    >
                      수정
                    </button>{' '}
                    <button
                      className="danger"
                      onClick={() => {
                        if (confirm(`"${r.name}" 규칙을 삭제할까요?`)) act(() => api.deleteRule(r.id))
                      }}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}
