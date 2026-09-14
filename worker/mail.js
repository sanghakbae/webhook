// 메일 발송. Resend 키가 있으면 Resend, 없으면 Cloudflare Email Sending 바인딩을 쓴다.
export async function sendMail(env, { to, subject, html, text }) {
  if (env.RESEND_API_KEY) return sendViaResend(env, { to, subject, html, text })
  if (env.EMAIL) return sendViaCloudflare(env, { to, subject, html, text })
  return { ok: false, detail: 'RESEND_API_KEY 미설정, EMAIL 바인딩도 없음' }
}

async function sendViaResend(env, { to, subject, html, text }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: env.MAIL_FROM, to, subject, html, text }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, detail: `Resend ${res.status} ${body.slice(0, 300)}` }
  let id = ''
  try {
    id = JSON.parse(body).id || ''
  } catch {}
  return { ok: true, detail: id }
}

// MAIL_FROM 은 "이름 <주소>" 형태도 허용한다.
function parseFrom(value) {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(value || '')
  return m ? { name: m[1] || undefined, email: m[2] } : { email: (value || '').trim() }
}

async function sendViaCloudflare(env, { to, subject, html, text }) {
  try {
    const result = await env.EMAIL.send({
      to,
      from: parseFrom(env.MAIL_FROM),
      subject,
      text,
      html,
    })
    return { ok: true, detail: result?.messageId || 'cloudflare' }
  } catch (err) {
    // 수신 주소가 Email Routing 에 인증돼 있지 않으면 여기서 걸린다.
    return { ok: false, detail: `Cloudflare Email: ${String(err?.message || err)}` }
  }
}
