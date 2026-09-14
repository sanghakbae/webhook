import { useEffect, useState } from 'react'
import { registerSW } from 'virtual:pwa-register'

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function PwaBar() {
  const [needRefresh, setNeedRefresh] = useState(false)
  const [updateSW, setUpdateSW] = useState(null)
  const [installEvent, setInstallEvent] = useState(null)
  const [showIosHint, setShowIosHint] = useState(false)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem('pwa-install-dismissed') === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    const fn = registerSW({ onNeedRefresh: () => setNeedRefresh(true) })
    setUpdateSW(() => fn)

    // autoUpdate 는 새 워커가 곧바로 제어권을 가져간다. 그 순간을 잡아 알린다.
    // 최초 설치 때도 controllerchange 가 한 번 뜨므로, 이전 워커가 있었을 때만 알림.
    if (!('serviceWorker' in navigator)) return
    const hadController = !!navigator.serviceWorker.controller
    const onChange = () => {
      if (hadController) setNeedRefresh(true)
    }
    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onChange)
  }, [])

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault()
      setInstallEvent(e)
    }
    const onInstalled = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    // iOS Safari 는 beforeinstallprompt 를 지원하지 않아 안내로 대신한다.
    if (isIos() && !isStandalone()) setShowIosHint(true)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const hide = () => {
    setDismissed(true)
    try {
      localStorage.setItem('pwa-install-dismissed', '1')
    } catch {}
  }

  if (needRefresh)
    return (
      <div className="pwa-bar">
        <span>새 버전이 준비됐습니다.</span>
        <div className="pwa-bar-actions">
          <button
            className="sm primary"
            onClick={() => {
              try {
                updateSW?.(true)
              } catch {}
              window.location.reload()
            }}
          >
            새로고침
          </button>
          <button className="sm" onClick={() => setNeedRefresh(false)}>
            나중에
          </button>
        </div>
      </div>
    )

  if (dismissed || isStandalone()) return null

  if (installEvent)
    return (
      <div className="pwa-bar">
        <span>홈 화면에 설치하면 앱처럼 쓸 수 있습니다.</span>
        <div className="pwa-bar-actions">
          <button
            className="sm primary"
            onClick={async () => {
              installEvent.prompt()
              await installEvent.userChoice
              setInstallEvent(null)
            }}
          >
            설치
          </button>
          <button className="sm" onClick={hide}>
            닫기
          </button>
        </div>
      </div>
    )

  if (showIosHint)
    return (
      <div className="pwa-bar">
        <span>
          공유 <b>􀈂</b> → <b>홈 화면에 추가</b> 로 설치할 수 있습니다.
        </span>
        <div className="pwa-bar-actions">
          <button className="sm" onClick={hide}>
            닫기
          </button>
        </div>
      </div>
    )

  return null
}
