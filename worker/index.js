import { verifyIdToken, verifySignature } from './auth.js'
import { matchRule, renderTemplate, buildEmail } from './rules.js'
import { sendMail } from './mail.js'

const MAX_BODY = 64 * 1024
const uid = () => crypto.randomUUID().replace(/-/g, '')
const now = () => Date.now()

function corsHeaders(env, request) {
  const origin = request.headers.get('Origin') || ''
  const allowed = (env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const ok = allowed.includes(origin)
  return {
    'Access-Control-Allow-Origin': ok ? origin : allowed[0] || '',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

const json = (env, request, data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...corsHeaders(env, request) },
  })

// 성공하면 { user }, 실패하면 { error } — 401 원인을 화면에서 바로 알 수 있게 구분한다.
async function requireUser(request, env) {
  const auth = request.headers.get('Authorization') || ''
  if (!auth.startsWith('Bearer ')) return { error: '로그인이 필요합니다' }
  const user = await verifyIdToken(auth.slice(7), env.FIREBASE_PROJECT_ID)
  if (!user) return { error: '토큰 검증 실패 (만료됐거나 다른 Firebase 프로젝트의 토큰)' }
  const allow = (env.ALLOWED_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  if (allow.length && !allow.includes(user.email)) {
    return {
      error: `허용되지 않은 계정입니다: ${user.email} (허용: ${allow.join(', ')})`,
    }
  }
  return { user }
}

// ---------------------------------------------------------------- 웹훅 수신
async function ingest(request, env, ctx, token) {
  const ep = await env.DB.prepare('SELECT * FROM endpoints WHERE token = ?').bind(token).first()
  if (!ep) return new Response('unknown endpoint', { status: 404 })
  if (ep.paused) return new Response('paused', { status: 202 })

  const raw = await request.text()
  const body = raw.length > MAX_BODY ? raw.slice(0, MAX_BODY) : raw
  const truncated = raw.length > MAX_BODY

  const headers = {}
  for (const [k, v] of request.headers) {
    if (['authorization', 'cookie'].includes(k.toLowerCase())) continue
    headers[k] = v
  }

  let sigOk = null
  if (ep.secret && ep.sig_header) {
    sigOk = (await verifySignature(ep.secret, request.headers.get(ep.sig_header), raw)) ? 1 : 0
    if (sigOk === 0) {
      await recordEvent(env, ep, request, body, headers, sigOk, 0)
      return new Response('signature mismatch', { status: 401 })
    }
  }

  let parsed = null
  try {
    parsed = JSON.parse(raw)
  } catch {}

  const rules = await env.DB.prepare(
    'SELECT * FROM rules WHERE uid = ? AND enabled = 1 AND (endpoint_id IS NULL OR endpoint_id = ?)',
  )
    .bind(ep.uid, ep.id)
    .all()

  const receivedAt = now()
  const matchCtx = {
    endpoint: ep,
    json: parsed,
    rawBody: raw,
    method: request.method,
    contentType: request.headers.get('Content-Type'),
    sourceIp: request.headers.get('CF-Connecting-IP'),
    sigOk,
    receivedAt,
  }
  const hits = (rules.results || []).filter((r) => matchRule(r, matchCtx))
  const eventId = await recordEvent(env, ep, request, body, headers, sigOk, hits.length, receivedAt)

  if (hits.length) {
    ctx.waitUntil(deliver(env, { ...matchCtx, eventId, truncated }, hits))
  }
  ctx.waitUntil(cleanup(env))

  return new Response(JSON.stringify({ ok: true, event_id: eventId, matched: hits.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
}

async function recordEvent(env, ep, request, body, headers, sigOk, matched, receivedAt = now()) {
  const id = uid()
  await env.DB.prepare(
    `INSERT INTO events (id, endpoint_id, uid, method, headers, query, body, content_type, source_ip, sig_ok, matched, received_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
  )
    .bind(
      id,
      ep.id,
      ep.uid,
      request.method,
      JSON.stringify(headers),
      new URL(request.url).search,
      body,
      request.headers.get('Content-Type'),
      request.headers.get('CF-Connecting-IP'),
      sigOk,
      matched,
      receivedAt,
    )
    .run()
  return id
}

async function deliver(env, ctx, rules) {
  for (const rule of rules) {
    const t = now()
    if (rule.throttle_s > 0 && t - rule.last_fired < rule.throttle_s * 1000) {
      await logDelivery(env, ctx, rule, 'throttled', `${rule.throttle_s}초 제한`, recipientsOf(env, rule).join(', '))
      continue
    }
    const full = { ...ctx, rule }
    const { html, text } = buildEmail(full)
    const to = recipientsOf(env, rule)
    const result = await sendMail(env, {
      to,
      subject: renderTemplate(rule.subject_tpl, full),
      html,
      text,
    })
    await logDelivery(env, ctx, rule, result.ok ? 'sent' : 'failed', result.detail, to.join(', '))
    if (result.ok) {
      await env.DB.prepare('UPDATE rules SET last_fired = ? WHERE id = ?').bind(t, rule.id).run()
    }
  }
}

// MAIL_TO 가 정해져 있으면 그것만 쓴다. 규칙의 recipients 는 기록용으로만 남는다.
function recipientsOf(env, rule) {
  const source = env.MAIL_TO || rule.recipients || ''
  return source
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function logDelivery(env, ctx, rule, status, detail, recipients) {
  return env.DB.prepare(
    'INSERT INTO deliveries (id, uid, event_id, rule_id, recipients, status, detail, created_at) VALUES (?,?,?,?,?,?,?,?)',
  )
    .bind(uid(), ctx.endpoint.uid, ctx.eventId, rule.id, recipients, status, detail || '', now())
    .run()
}

let lastCleanup = 0
async function cleanup(env) {
  const t = now()
  if (t - lastCleanup < 3600_000) return
  lastCleanup = t
  const days = Number(env.EVENT_RETENTION_DAYS || 30)
  const cutoff = t - days * 86400_000
  await env.DB.prepare('DELETE FROM events WHERE received_at < ?').bind(cutoff).run()
  await env.DB.prepare('DELETE FROM deliveries WHERE created_at < ?').bind(cutoff).run()
}

// ------------------------------------------------------------------- API
async function api(request, env, path, user) {
  const url = new URL(request.url)
  const m = request.method
  const seg = path.split('/').filter(Boolean) // ['endpoints', ...]

  // --- endpoints
  if (seg[0] === 'endpoints' && seg.length === 1) {
    if (m === 'GET') {
      const rows = await env.DB.prepare(
        `SELECT e.*, (SELECT COUNT(*) FROM events v WHERE v.endpoint_id = e.id) AS event_count,
                (SELECT MAX(received_at) FROM events v WHERE v.endpoint_id = e.id) AS last_event
         FROM endpoints e WHERE e.uid = ? ORDER BY e.created_at DESC`,
      )
        .bind(user.uid)
        .all()
      return json(env, request, { items: rows.results || [] })
    }
    if (m === 'POST') {
      const b = await request.json()
      if (!b.name) return json(env, request, { error: '이름은 필수입니다' }, 400)
      const id = uid()
      await env.DB.prepare(
        'INSERT INTO endpoints (id, uid, name, token, secret, sig_header, paused, created_at) VALUES (?,?,?,?,?,?,0,?)',
      )
        .bind(id, user.uid, b.name, uid() + uid(), b.secret || null, b.sig_header || null, now())
        .run()
      const row = await env.DB.prepare('SELECT * FROM endpoints WHERE id = ?').bind(id).first()
      return json(env, request, row, 201)
    }
  }

  if (seg[0] === 'endpoints' && seg.length === 2) {
    const row = await env.DB.prepare('SELECT * FROM endpoints WHERE id = ? AND uid = ?')
      .bind(seg[1], user.uid)
      .first()
    if (!row) return json(env, request, { error: '없는 엔드포인트' }, 404)
    if (m === 'PATCH') {
      const b = await request.json()
      await env.DB.prepare(
        'UPDATE endpoints SET name = ?, secret = ?, sig_header = ?, paused = ? WHERE id = ? AND uid = ?',
      )
        .bind(
          b.name ?? row.name,
          b.secret === undefined ? row.secret : b.secret || null,
          b.sig_header === undefined ? row.sig_header : b.sig_header || null,
          b.paused === undefined ? row.paused : b.paused ? 1 : 0,
          seg[1],
          user.uid,
        )
        .run()
      return json(env, request, { ok: true })
    }
    if (m === 'DELETE') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM events WHERE endpoint_id = ? AND uid = ?').bind(seg[1], user.uid),
        env.DB.prepare('DELETE FROM endpoints WHERE id = ? AND uid = ?').bind(seg[1], user.uid),
      ])
      return json(env, request, { ok: true })
    }
    if (m === 'POST') {
      // 토큰 재발급
      const token = uid() + uid()
      await env.DB.prepare('UPDATE endpoints SET token = ? WHERE id = ? AND uid = ?')
        .bind(token, seg[1], user.uid)
        .run()
      return json(env, request, { token })
    }
  }

  // --- events
  if (seg[0] === 'events' && seg.length === 1 && m === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit') || 50), 200)
    const before = Number(url.searchParams.get('before') || 0) || now() + 1
    const epId = url.searchParams.get('endpoint') || ''
    const onlyMatched = url.searchParams.get('matched') === '1'
    const sql = `SELECT v.id, v.endpoint_id, v.method, v.content_type, v.source_ip, v.sig_ok, v.matched, v.received_at,
                        substr(v.body, 1, 300) AS preview, e.name AS endpoint_name
                 FROM events v JOIN endpoints e ON e.id = v.endpoint_id
                 WHERE v.uid = ? AND v.received_at < ?
                   ${epId ? 'AND v.endpoint_id = ?' : ''}
                   ${onlyMatched ? 'AND v.matched > 0' : ''}
                 ORDER BY v.received_at DESC LIMIT ?`
    const binds = epId ? [user.uid, before, epId, limit] : [user.uid, before, limit]
    const rows = await env.DB.prepare(sql).bind(...binds).all()
    return json(env, request, { items: rows.results || [] })
  }

  if (seg[0] === 'events' && seg.length === 2 && m === 'GET') {
    const row = await env.DB.prepare(
      'SELECT v.*, e.name AS endpoint_name FROM events v JOIN endpoints e ON e.id = v.endpoint_id WHERE v.id = ? AND v.uid = ?',
    )
      .bind(seg[1], user.uid)
      .first()
    if (!row) return json(env, request, { error: '없는 이벤트' }, 404)
    const dels = await env.DB.prepare(
      'SELECT * FROM deliveries WHERE event_id = ? ORDER BY created_at DESC',
    )
      .bind(seg[1])
      .all()
    return json(env, request, { ...row, deliveries: dels.results || [] })
  }

  // 이벤트 재전송 (메일만 다시 보냄)
  if (seg[0] === 'events' && seg.length === 3 && seg[2] === 'resend' && m === 'POST') {
    const ev = await env.DB.prepare('SELECT * FROM events WHERE id = ? AND uid = ?')
      .bind(seg[1], user.uid)
      .first()
    if (!ev) return json(env, request, { error: '없는 이벤트' }, 404)
    const ep = await env.DB.prepare('SELECT * FROM endpoints WHERE id = ?').bind(ev.endpoint_id).first()
    const { rule_id } = await request.json().catch(() => ({}))
    const rules = rule_id
      ? [await env.DB.prepare('SELECT * FROM rules WHERE id = ? AND uid = ?').bind(rule_id, user.uid).first()]
      : (
          await env.DB.prepare(
            'SELECT * FROM rules WHERE uid = ? AND (endpoint_id IS NULL OR endpoint_id = ?)',
          )
            .bind(user.uid, ev.endpoint_id)
            .all()
        ).results
    const valid = (rules || []).filter(Boolean)
    if (!valid.length) return json(env, request, { error: '보낼 규칙이 없습니다' }, 400)
    let parsed = null
    try {
      parsed = JSON.parse(ev.body)
    } catch {}
    await deliver(
      env,
      {
        endpoint: ep,
        json: parsed,
        rawBody: ev.body,
        method: ev.method,
        contentType: ev.content_type,
        sourceIp: ev.source_ip,
        sigOk: ev.sig_ok,
        receivedAt: ev.received_at,
        eventId: ev.id,
      },
      valid.map((r) => ({ ...r, throttle_s: 0 })),
    )
    return json(env, request, { ok: true, count: valid.length })
  }

  // --- rules
  if (seg[0] === 'rules' && seg.length === 1) {
    if (m === 'GET') {
      const rows = await env.DB.prepare('SELECT * FROM rules WHERE uid = ? ORDER BY created_at DESC')
        .bind(user.uid)
        .all()
      return json(env, request, { items: rows.results || [] })
    }
    if (m === 'POST') {
      const b = await request.json()
      if (!b.name) return json(env, request, { error: '이름은 필수입니다' }, 400)
      const recipients = env.MAIL_TO || b.recipients
      if (!recipients) return json(env, request, { error: '수신자가 설정되지 않았습니다' }, 400)
      const id = uid()
      await env.DB.prepare(
        `INSERT INTO rules (id, uid, endpoint_id, name, enabled, match_type, field, op, value, recipients, subject_tpl, throttle_s, last_fired, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,0,?)`,
      )
        .bind(
          id,
          user.uid,
          b.endpoint_id || null,
          b.name,
          b.enabled === false ? 0 : 1,
          b.match_type || 'always',
          b.field || null,
          b.op || null,
          b.value ?? null,
          recipients,
          b.subject_tpl || null,
          Number(b.throttle_s || 0),
          now(),
        )
        .run()
      return json(env, request, { id }, 201)
    }
  }

  if (seg[0] === 'rules' && seg.length === 2) {
    const row = await env.DB.prepare('SELECT * FROM rules WHERE id = ? AND uid = ?')
      .bind(seg[1], user.uid)
      .first()
    if (!row) return json(env, request, { error: '없는 규칙' }, 404)
    if (m === 'PATCH') {
      const b = await request.json()
      const merged = { ...row, ...b }
      await env.DB.prepare(
        `UPDATE rules SET endpoint_id = ?, name = ?, enabled = ?, match_type = ?, field = ?, op = ?, value = ?,
                          recipients = ?, subject_tpl = ?, throttle_s = ? WHERE id = ? AND uid = ?`,
      )
        .bind(
          merged.endpoint_id || null,
          merged.name,
          merged.enabled ? 1 : 0,
          merged.match_type,
          merged.field || null,
          merged.op || null,
          merged.value ?? null,
          env.MAIL_TO || merged.recipients,
          merged.subject_tpl || null,
          Number(merged.throttle_s || 0),
          seg[1],
          user.uid,
        )
        .run()
      return json(env, request, { ok: true })
    }
    if (m === 'DELETE') {
      await env.DB.prepare('DELETE FROM rules WHERE id = ? AND uid = ?').bind(seg[1], user.uid).run()
      return json(env, request, { ok: true })
    }
  }

  // --- deliveries
  if (seg[0] === 'deliveries' && m === 'GET') {
    const rows = await env.DB.prepare(
      'SELECT * FROM deliveries WHERE uid = ? ORDER BY created_at DESC LIMIT 100',
    )
      .bind(user.uid)
      .all()
    return json(env, request, { items: rows.results || [] })
  }

  // --- 통계
  if (seg[0] === 'stats' && m === 'GET') {
    const since = now() - 7 * 86400_000
    const [eps, ev24, evWeek, sent, failed] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) AS c FROM endpoints WHERE uid = ?').bind(user.uid).first(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM events WHERE uid = ? AND received_at > ?')
        .bind(user.uid, now() - 86400_000)
        .first(),
      env.DB.prepare('SELECT COUNT(*) AS c FROM events WHERE uid = ? AND received_at > ?')
        .bind(user.uid, since)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) AS c FROM deliveries WHERE uid = ? AND status = 'sent' AND created_at > ?",
      )
        .bind(user.uid, since)
        .first(),
      env.DB.prepare(
        "SELECT COUNT(*) AS c FROM deliveries WHERE uid = ? AND status = 'failed' AND created_at > ?",
      )
        .bind(user.uid, since)
        .first(),
    ])
    return json(env, request, {
      endpoints: eps.c,
      events_24h: ev24.c,
      events_7d: evWeek.c,
      sent_7d: sent.c,
      failed_7d: failed.c,
    })
  }

  // --- 화면이 고정 수신 주소를 표시하기 위한 설정 조회
  if (seg[0] === 'config' && m === 'GET') {
    return json(env, request, { mail_to: env.MAIL_TO || '', mail_from: env.MAIL_FROM || '' })
  }

  // --- 테스트 메일
  if (seg[0] === 'test-email' && m === 'POST') {
    const result = await sendMail(env, {
      to: recipientsOf(env, { recipients: user.email }),
      subject: '[웹훅 알림] 테스트 메일',
      html: '<p>메일 발송 설정이 정상입니다. 🎉</p>',
      text: '메일 발송 설정이 정상입니다.',
    })
    // 실패 사유를 error 로도 담아야 화면이 "요청 실패 (502)" 대신 원인을 보여준다.
    return json(
      env,
      request,
      result.ok ? result : { ...result, error: result.detail },
      result.ok ? 200 : 502,
    )
  }

  return json(env, request, { error: 'not found' }, 404)
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env, request) })
    }

    if (url.pathname.startsWith('/w/')) {
      return ingest(request, env, ctx, url.pathname.slice(3))
    }

    if (url.pathname.startsWith('/api/')) {
      const { user, error } = await requireUser(request, env)
      if (!user) return json(env, request, { error }, 401)
      try {
        return await api(request, env, url.pathname.slice(5), user)
      } catch (err) {
        return json(env, request, { error: String(err?.message || err) }, 500)
      }
    }

    return new Response('webhook-alert worker', { status: 200 })
  },
}
