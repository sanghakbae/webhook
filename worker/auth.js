// Firebase ID 토큰 검증 (Google 공개 JWK로 RS256 서명 확인)
const JWK_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

let jwkCache = { keys: null, expires: 0 }

async function getKeys() {
  const now = Date.now()
  if (jwkCache.keys && now < jwkCache.expires) return jwkCache.keys
  const res = await fetch(JWK_URL)
  if (!res.ok) throw new Error('JWK 조회 실패')
  const data = await res.json()
  const maxAge = /max-age=(\d+)/.exec(res.headers.get('cache-control') || '')
  jwkCache = {
    keys: data.keys,
    expires: now + (maxAge ? Number(maxAge[1]) : 3600) * 1000,
  }
  return jwkCache.keys
}

function b64urlToBytes(s) {
  const pad = s.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(pad + '='.repeat((4 - (pad.length % 4)) % 4))
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJson(seg) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(seg)))
}

// 성공 시 { uid, email }, 실패 시 null
export async function verifyIdToken(token, projectId) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const header = decodeJson(parts[0])
    const payload = decodeJson(parts[1])
    if (header.alg !== 'RS256' || !header.kid) return null

    const now = Math.floor(Date.now() / 1000)
    if (payload.exp <= now) return null
    if (payload.iat > now + 60) return null
    if (payload.aud !== projectId) return null
    if (payload.iss !== `https://securetoken.google.com/${projectId}`) return null
    if (!payload.sub) return null

    const jwk = (await getKeys()).find((k) => k.kid === header.kid)
    if (!jwk) return null
    const key = await crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    const ok = await crypto.subtle.verify(
      'RSASSA-PKCS1-v1_5',
      key,
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
    )
    if (!ok) return null
    return { uid: payload.sub, email: (payload.email || '').toLowerCase() }
  } catch {
    return null
  }
}

// 웹훅 서명 검증: HMAC-SHA256, "sha256=<hex>" 또는 hex/base64 원문 모두 허용
export async function verifySignature(secret, header, rawBody) {
  if (!secret || !header) return null
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)),
  )
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('')
  const b64 = btoa(String.fromCharCode(...mac))
  const got = header.trim().replace(/^sha256=/i, '')
  return timingSafeEqual(got, hex) || timingSafeEqual(got, b64)
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
