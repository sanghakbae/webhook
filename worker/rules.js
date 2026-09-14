// 규칙 매칭 + 메일 본문 구성

// Worker 의 기본 시간대는 UTC 라 명시하지 않으면 9시간 어긋난 시각이 찍힌다.
const KST = (ms) =>
  new Date(ms).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })


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

function resolveKey(key, ctx) {
  if (key === 'endpoint') return ctx.endpoint.name
  if (key === 'rule') return ctx.rule?.name ?? ''
  if (key === 'time') return KST(ctx.receivedAt)
  const v = getPath(ctx.json ?? {}, key)
  if (v === undefined || v === null) return ''
  return typeof v === 'object' ? JSON.stringify(v) : String(v)
}

// {{a|b|c}} — 페이로드마다 필드 이름이 달라서, 있는 것 중 첫 번째를 쓴다.
export function renderTemplate(tpl, ctx) {
  const base = tpl || '[웹훅] {{endpoint}}'
  const out = base.replace(/\{\{\s*([\w.|\s]+?)\s*\}\}/g, (_, expr) => {
    for (const key of expr.split('|').map((k) => k.trim()).filter(Boolean)) {
      const v = resolveKey(key, ctx)
      if (v !== '') return v
    }
    return ''
  })
  // 참조한 필드가 하나도 없으면 제목이 통째로 비어버린다. 그때는 엔드포인트 이름으로 대체.
  return out.trim() || `[웹훅] ${ctx.endpoint.name}`
}

// 제목은 메일 헤더로 들어간다. 줄바꿈이 섞이면 헤더가 오염되므로 한 줄로 눌러 담는다.
export function subjectOf(tpl, ctx) {
  return renderTemplate(tpl, ctx).replace(/[\r\n\t]+/g, ' ').slice(0, 200)
}

const esc = (s) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

export function buildEmail(ctx) {
  const meta = [
    ['엔드포인트', ctx.endpoint.name],
    ['규칙', ctx.rule?.name ?? '-'],
    ['수신 시각', KST(ctx.receivedAt)],
    ['메서드', ctx.method],
    ['Content-Type', ctx.contentType || '-'],
    ['출처 IP', ctx.sourceIp || '-'],
    ['서명 검증', ctx.sigOk === null ? '미사용' : ctx.sigOk ? '통과' : '실패'],
  ]

  // 본문 템플릿이 있으면 읽을 수 있는 내용을, 없으면 페이로드 원문을 싣는다.
  const rendered = ctx.rule?.body_tpl ? renderTemplate(ctx.rule.body_tpl, ctx) : ''
  const raw = ctx.json ? JSON.stringify(ctx.json, null, 2) : ctx.rawBody || '(본문 없음)'
  const body = rendered || (raw.length > 20000 ? raw.slice(0, 20000) + '\n… (생략)' : raw)

  const content = rendered
    ? `<div style="font-size:15px;line-height:1.7;white-space:pre-wrap;margin-bottom:20px">${esc(body)}</div>`
    : `<div style="font-size:12px;color:#475569;margin:16px 0 6px">페이로드</div>
  <pre style="background:#0f172a;color:#e2e8f0;padding:14px;border-radius:8px;font-size:12px;overflow-x:auto;white-space:pre-wrap;word-break:break-all">${esc(body)}</pre>`

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Apple SD Gothic Neo',sans-serif;max-width:680px;margin:0 auto;color:#0f172a">
  <p style="margin:0 0 16px;color:#64748b;font-size:13px">${esc(ctx.endpoint.name)} 엔드포인트로 요청이 도착했습니다.</p>
  ${content}
  <table style="border-collapse:collapse;width:100%;font-size:13px">
    ${meta
      .map(
        ([k, v]) =>
          `<tr><td style="padding:6px 10px;background:#f1f5f9;border:1px solid #e2e8f0;width:130px;color:#475569">${esc(k)}</td><td style="padding:6px 10px;border:1px solid #e2e8f0">${esc(v)}</td></tr>`,
      )
      .join('')}
  </table>
</div>`

  const text = `${body}\n\n${'-'.repeat(30)}\n` + meta.map(([k, v]) => `${k}: ${v}`).join('\n')
  return { html, text }
}
