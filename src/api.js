import { auth } from './firebase'

export const WORKER_BASE = (import.meta.env.VITE_WORKER_BASE || '').replace(/\/$/, '')

async function call(path, { method = 'GET', body } = {}) {
  const user = auth.currentUser
  if (!user) throw new Error('로그인이 필요합니다')
  const token = await user.getIdToken()
  const res = await fetch(`${WORKER_BASE}/api${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { error: text }
  }
  if (!res.ok) throw new Error(data?.error || `요청 실패 (${res.status})`)
  return data
}

export const ingestUrl = (token) =>
  `${WORKER_BASE || window.location.origin}/w/${token}`

export const api = {
  stats: () => call('/stats'),
  listEndpoints: () => call('/endpoints'),
  createEndpoint: (body) => call('/endpoints', { method: 'POST', body }),
  updateEndpoint: (id, body) => call(`/endpoints/${id}`, { method: 'PATCH', body }),
  deleteEndpoint: (id) => call(`/endpoints/${id}`, { method: 'DELETE' }),
  rotateToken: (id) => call(`/endpoints/${id}`, { method: 'POST', body: {} }),
  listEvents: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null),
    ).toString()
    return call(`/events${q ? `?${q}` : ''}`)
  },
  getEvent: (id) => call(`/events/${id}`),
  resendEvent: (id, rule_id) => call(`/events/${id}/resend`, { method: 'POST', body: { rule_id } }),
  listRules: () => call('/rules'),
  createRule: (body) => call('/rules', { method: 'POST', body }),
  updateRule: (id, body) => call(`/rules/${id}`, { method: 'PATCH', body }),
  deleteRule: (id) => call(`/rules/${id}`, { method: 'DELETE' }),
  listDeliveries: () => call('/deliveries'),
  testEmail: (to) => call('/test-email', { method: 'POST', body: { to } }),
}

export const fmtTime = (ms) =>
  ms ? new Date(ms).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'medium' }) : '-'
