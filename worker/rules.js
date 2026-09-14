// 규칙 매칭 + 메일 본문 구성

export function getPath(obj, path) {
  if (!path) return undefined
  return path.split('.').reduce((acc, k) => {
    if (acc == null) return undefined
    return acc[k]
  }, obj)
}

export function matchRule(rule, ctx) {
  if (!rule.enabled) return false
  if (rule.endpoint_id && rule.endpoint_id !== ctx.endpoint.id) return false

  if (rule.match_type === 'always') return true

  if (rule.match_type === 'contains') {
    const needle = String(rule.value ?? '')
    return needle !== '' && (ctx.rawBody || '').includes(needle)
  }

  if (rule.match_type === 'jsonpath') {
    if (ctx.json == null) return false
    const actual = getPath(ctx.json, rule.field)
    const expected = rule.value
    switch (rule.op) {
      case 'exists':
        return actual !== undefined
      case 'eq':
        return String(actual) === String(expected)
      case 'ne':
        return String(actual) !== String(expected)
      case 'contains':
        return String(actual ?? '').includes(String(expected ?? ''))
      case 'gt':
        return Number(actual) > Number(expected)
      case 'lt':
        return Number(actual) < Number(expected)
      default:
        return false
    }
  }
  return false
}

export function renderTemplate(tpl, ctx) {
  const base = tpl || '[웹훅] {{endpoint}}'
  const out = base.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    if (key === 'endpoint') return ctx.endpoint.name
    if (key === 'rule') return ctx.rule?.name ?? ''
    if (key === 'time') return new Date(ctx.receivedAt).toLocaleString('ko-KR')
    const v = getPath(ctx.json ?? {}, key)
    return v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
  })
  // 참조한 필드가 페이로드에 없으면 제목이 통째로 비어버린다. 그때는 엔드포인트 이름으로 대체.
  return out.trim() || `[웹훅] ${ctx.endpoint.name}`
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function buildEmail(ctx) {
  const meta = [
    ['엔드포인트', ctx.endpoint.name],
    ['수신 시각', new Date(ctx.receivedAt).toLocaleString('ko-KR')],
  ]

  // 본문 템플릿이 있으면 그것만 싣는다. 원문이 필요하면 대시보드의 수신 로그에 남아 있다.
  const rendered = ctx.rule?.body_tpl ? renderTemplate(ctx.rule.body_tpl, ctx) : ''
  if (rendered) return compose(rendered, meta, ctx)

  const pretty = ctx.json ? JSON.stringify(ctx.json, null, 2) : ctx.rawBody || '(본문 없음)'
  const clipped = pretty.length > 20000 ? pretty.slice(0, 20000) + '\n… (생략)' : pretty
  meta.push(
    ['규칙', ctx.rule?.name ?? '-'],
    ['메서드', ctx.method],
    ['Content-Type', ctx.contentType || '-'],
    ['출처 IP', ctx.sourceIp || '-'],
    ['서명 검증', ctx.sigOk === null ? '미사용' : ctx.sigOk ? '통과' : '실패'],
  )
  return compose(clipped, meta, ctx, true)
}

function compose(body, meta, ctx, raw = false) {
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
  ${
    raw
      ? `<h2 style="margin:0 0 12px;font-size:18px">웹훅 수신 알림</h2>
  <table style="border-collapse:collapse;width:100%;font-size:13px;margin-bottom:16px">
    ${meta
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 10px;background:#f1f5f9;border:1px solid #e2e8f0;width:130px;color:#475569">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${esc(v)}</td></tr>`,
      )
      .join('')}
  </table>
  <div style="font-size:12px;color:#475569;margin-bottom:6px">페이로드</div>
  <pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${esc(body)}</pre>`
      : `<div style="font-size:15px;line-height:1.7;white-space:pre-wrap">${esc(body)}</div>
  <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0 10px">
  <div style="font-size:12px;color:#64748b">${meta.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join(' · ')}</div>`
  }
</div>`
  const text = raw ? meta.map(([k, v]) => `${k}: ${v}`).join('\n') + '\n\n' + body : body
  return { html, text }
}
