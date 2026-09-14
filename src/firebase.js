import { initializeApp } from 'firebase/app'
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  onAuthStateChanged,
} from 'firebase/auth'

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// 빌드 시 환경변수가 비면 Firebase 초기화가 예외를 던져 화면이 통째로 하얘진다.
// 그 대신 무엇이 비었는지 화면에 띄우기 위해, 여기서는 던지지 않고 목록만 넘긴다.
export const configMissing = Object.entries(cfg)
  .filter(([, v]) => !v)
  .map(([k]) => `VITE_FIREBASE_${k.replace(/[A-Z]/g, (c) => '_' + c).toUpperCase()}`)

export const auth = configMissing.length ? null : getAuth(initializeApp(cfg))

export const signIn = () => signInWithPopup(auth, new GoogleAuthProvider())
export const signOut = () => fbSignOut(auth)
export const watchAuth = (cb) => {
  if (!auth) return () => {}
  return onAuthStateChanged(auth, cb)
}
