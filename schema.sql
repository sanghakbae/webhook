-- 웹훅 알림 허브 D1 스키마
CREATE TABLE IF NOT EXISTS endpoints (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  name        TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,   -- 공개 수신 URL 경로에 쓰이는 비밀 토큰
  secret      TEXT,                   -- HMAC 서명 검증용 (선택)
  sig_header  TEXT,                   -- 예: X-Hub-Signature-256
  paused      INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_endpoints_uid ON endpoints(uid);

CREATE TABLE IF NOT EXISTS events (
  id           TEXT PRIMARY KEY,
  endpoint_id  TEXT NOT NULL,
  uid          TEXT NOT NULL,
  method       TEXT NOT NULL,
  headers      TEXT NOT NULL,   -- JSON
  query        TEXT,
  body         TEXT,            -- 원문 (최대 64KB)
  content_type TEXT,
  source_ip    TEXT,
  sig_ok       INTEGER,         -- NULL=검증안함, 1=통과, 0=실패
  matched      INTEGER NOT NULL DEFAULT 0,
  received_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_uid_time ON events(uid, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_ep_time ON events(endpoint_id, received_at DESC);

CREATE TABLE IF NOT EXISTS rules (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  endpoint_id TEXT,             -- NULL = 모든 엔드포인트
  name        TEXT NOT NULL,
  enabled     INTEGER NOT NULL DEFAULT 1,
  match_type  TEXT NOT NULL,    -- always | jsonpath | contains
  field       TEXT,             -- jsonpath: a.b.c  (배열은 a.0.b)
  op          TEXT,             -- eq ne contains gt lt exists
  value       TEXT,
  recipients  TEXT NOT NULL,    -- 콤마 구분 이메일
  subject_tpl TEXT,             -- {{endpoint}} {{event}} 등 치환
  throttle_s  INTEGER NOT NULL DEFAULT 0,
  last_fired  INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rules_uid ON rules(uid);

CREATE TABLE IF NOT EXISTS deliveries (
  id          TEXT PRIMARY KEY,
  uid         TEXT NOT NULL,
  event_id    TEXT NOT NULL,
  rule_id     TEXT,
  recipients  TEXT NOT NULL,
  status      TEXT NOT NULL,   -- sent | failed | throttled
  detail      TEXT,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_deliveries_uid_time ON deliveries(uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_event ON deliveries(event_id);
