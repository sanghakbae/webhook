// Resend REST API로 메일 발송
export async function sendMail(env, { to, subject, html, text }) {
  if (!env.RESEND_API_KEY) {
    return { ok: false, detail: 'RESEND_API_KEY 미설정' }
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: env.MAIL_FROM || 'onboarding@resend.dev',
      to,
      subject,
      html,
      text,
    }),
  })
  const body = await res.text()
  if (!res.ok) return { ok: false, detail: `${res.status} ${body.slice(0, 300)}` }
  let id = ''
  try {
    id = JSON.parse(body).id || ''
  } catch {}
  return { ok: true, detail: id }
}
