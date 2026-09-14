# 웹훅 알림 허브

외부 시스템의 웹훅을 받아 **조건에 맞으면 메일로 알림**을 보내는 개인용 시스템.

- 프런트엔드: React + Vite + Firebase Auth(Google) → GitHub Pages (`webhook.sanghak.kr`)
- 백엔드: Cloudflare Worker + D1 (수신·저장·규칙 평가)
- 메일: Resend REST API → 기본 수신자 `bae@sanghak.kr`

## 동작

```
외부 서비스 ──POST──▶ Worker /w/<토큰> ──▶ D1 저장
                                      └──▶ 규칙 매칭 ──▶ Resend ──▶ 메일
브라우저 ──Firebase ID 토큰──▶ Worker /api/* ──▶ D1 조회
```

- 수신 응답은 메일 발송을 기다리지 않고 즉시 200 (`ctx.waitUntil`)
- 본문은 64KB까지 저장, 초과분은 잘림
- 이벤트/발송 이력은 `EVENT_RETENTION_DAYS`(기본 30일) 후 자동 삭제
- `Authorization`·`Cookie` 헤더는 저장하지 않음
- HMAC-SHA256 서명 검증 지원 (시크릿+헤더명 설정 시, 불일치는 401 + 로그만 남김)

## 화면

| 메뉴 | 내용 |
|---|---|
| 대시보드 | 수신/발송 통계, 최근 이벤트·메일 |
| 엔드포인트 | 수신 URL 발급·토큰 재발급·일시중지·서명 설정 |
| 수신 로그 | 원문 헤더/본문, 필터, 페이지네이션, 메일 재발송 |
| 알림 규칙 | 조건(항상 / JSON 필드 / 본문 포함) + 수신자 + 제목 템플릿 + 최소 간격 |
| 설정 | 테스트 메일, 연결 정보 |

## 최초 세팅

### 1. Cloudflare

```bash
npx wrangler d1 create webhook-alert          # 출력된 database_id를 wrangler.toml에 기입
npm run db:init                                # 원격 D1에 스키마 적용
npx wrangler secret put RESEND_API_KEY
npm run worker:deploy
```

`wrangler.toml`에서 채울 값:

| 변수 | 설명 |
|---|---|
| `database_id` | 위 `d1 create` 출력값 |
| `FIREBASE_PROJECT_ID` | ID 토큰 검증용 (aud/iss 확인) |
| `ALLOWED_EMAILS` | 접근 허용 계정 (콤마 구분) |
| `ALLOWED_ORIGINS` | CORS 허용 오리진 |
| `MAIL_FROM` | 발신 주소. **도메인이 Resend에 인증돼 있어야 함** |

### 2. Resend

1. resend.com 가입 → `sanghak.kr` 도메인 추가
2. 안내되는 SPF/DKIM DNS 레코드를 Cloudflare DNS에 등록
3. API 키 발급 → 위 `wrangler secret put`으로 등록

도메인 인증 전에는 `MAIL_FROM`을 `onboarding@resend.dev`로 두고 본인 주소로만 테스트 가능.

### 3. Firebase

Auth만 사용. Google 로그인 활성화 + 승인된 도메인에 `webhook.sanghak.kr` 추가.

### 4. GitHub Pages

레포 Settings → Pages → Source: GitHub Actions, 커스텀 도메인 `webhook.sanghak.kr`.

Secrets: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_APP_ID`
Variables: `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_WORKER_BASE`

## 로컬 개발

```bash
npm run db:init:local
npm run worker:dev     # :8787
npm run dev            # :5173, /api·/w 를 8787로 프록시
```

수신 테스트:

```bash
curl -X POST http://localhost:8787/w/<토큰> \
  -H 'Content-Type: application/json' \
  -d '{"workflow_run":{"conclusion":"failure"}}'
```

## 규칙 조건

| 종류 | 설명 | 예 |
|---|---|---|
| `always` | 모든 요청 | – |
| `jsonpath` | JSON 필드 비교 (`eq`/`ne`/`contains`/`gt`/`lt`/`exists`) | `workflow_run.conclusion` eq `failure` |
| `contains` | 본문 원문 문자열 포함 | `ERROR` |

배열은 점 표기로 인덱스 접근: `items.0.id`

제목 템플릿 치환: `{{endpoint}}`, `{{rule}}`, `{{time}}`, 그리고 JSON 경로(`{{repository.name}}`)

**규칙이 하나도 없으면 메일은 발송되지 않는다.** (수신 로그에는 남음)
