export default function Guide() {
  return (
    <>
      <div className="head">
        <div>
          <h1>사용법</h1>
          <p className="muted">3단계면 메일 알림이 시작됩니다.</p>
        </div>
      </div>

      <div className="panel">
        <h2>1. 엔드포인트 만들기</h2>
        <p>
          <b>엔드포인트</b> 메뉴에서 이름을 적고 만들면{' '}
          <code className="mono">https://…/w/&lt;토큰&gt;</code> 형태의 수신 URL이 발급됩니다. 이 URL을
          알림을 받고 싶은 서비스(GitHub, Sentry, 결제사, 사내 시스템 등)의 웹훅 주소로 등록하세요.
        </p>
        <p className="muted">
          토큰이 곧 인증입니다. 유출되면 <b>토큰 재발급</b>으로 기존 URL을 바로 무효화하세요. 서비스가
          HMAC 서명을 지원하면 시크릿과 헤더 이름을 채워두는 편이 안전합니다.
        </p>
      </div>

      <div className="panel">
        <h2>2. 알림 규칙 추가</h2>
        <p>
          엔드포인트를 만들면 규칙이 자동으로 하나 생깁니다(조건 항상 · 켜짐). <b>규칙이 하나도 없으면
          메일은 나가지 않습니다.</b> 모든 요청을 받아보려면 조건을 &quot;항상&quot;
          으로, 특정 상황만 받으려면 JSON 필드 조건을 씁니다. 받는 주소는 시스템 전역으로 고정돼
          있어 규칙마다 다르게 줄 수 없습니다.
        </p>
        <table>
          <thead>
            <tr>
              <th>하고 싶은 것</th>
              <th>설정</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>GitHub Actions 실패만 받기</td>
              <td className="mono">workflow_run.conclusion = failure</td>
            </tr>
            <tr>
              <td>본문에 ERROR가 있으면 받기</td>
              <td className="mono">본문 문자열 포함 → ERROR</td>
            </tr>
            <tr>
              <td>금액 10만원 초과 결제만</td>
              <td className="mono">amount 초과 100000</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          같은 규칙이 쉴 새 없이 터질 것 같으면 <b>최소 간격(초)</b>을 넣어 메일 폭탄을 막으세요.
        </p>
      </div>

      <div className="panel">
        <h2>3. 테스트</h2>
        <p>터미널에서 아래처럼 직접 쏴보면 즉시 확인됩니다.</p>
        <pre className="payload">{`curl -X POST https://…/w/<토큰> \\
  -H 'Content-Type: application/json' \\
  -d '{"status":"failure","message":"배포 실패"}'`}</pre>
        <p>
          <b>수신 로그</b>에 요청이 뜨고, 규칙에 걸렸다면 알림 건수가 표시됩니다. 메일이 안 오면{' '}
          <b>설정 → 테스트 메일</b>로 발송 경로부터 확인하세요.
        </p>
      </div>

      <div className="panel">
        <h2>앱으로 설치하기</h2>
        <p>
          홈 화면에 설치하면 브라우저 주소창 없이 앱처럼 열리고, 오프라인에서도 화면이 뜹니다.
        </p>
        <table>
          <thead>
            <tr>
              <th>환경</th>
              <th className="remark">설치 방법</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Android · Chrome</td>
              <td className="remark">하단에 뜨는 <b>설치</b> 버튼, 또는 메뉴 ⋮ → 앱 설치</td>
            </tr>
            <tr>
              <td>iPhone · Safari</td>
              <td className="remark">공유 버튼 → <b>홈 화면에 추가</b> (Safari에서만 됩니다)</td>
            </tr>
            <tr>
              <td>PC · Chrome/Edge</td>
              <td className="remark">주소창 오른쪽 설치 아이콘, 또는 메뉴 → 앱 설치</td>
            </tr>
          </tbody>
        </table>
        <p className="muted">
          새 버전이 배포되면 화면 아래에 알림이 뜹니다. <b>새로고침</b>을 누르면 바로 반영됩니다.
        </p>
      </div>

      <div className="panel">
        <h2>알아둘 점</h2>
        <ul className="muted" style={{ lineHeight: 1.8, paddingLeft: 18 }}>
          <li>본문은 64KB까지 저장하고, 그보다 길면 잘립니다.</li>
          <li>수신 로그와 발송 이력은 기본 30일 뒤 자동 삭제됩니다.</li>
          <li>서명 검증에 실패한 요청은 401로 거부하되 로그에는 남깁니다.</li>
          <li>Authorization·Cookie 헤더는 로그에 저장하지 않습니다.</li>
          <li>수신 응답은 메일 발송을 기다리지 않고 즉시 200을 돌려줍니다.</li>
        </ul>
      </div>
    </>
  )
}
