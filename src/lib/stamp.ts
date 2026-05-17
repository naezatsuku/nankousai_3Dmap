import { createHmac } from 'crypto'

export const WINDOW_SECS = 60 // 60秒ウィンドウ

export function currentWindow(): number {
  return Math.floor(Date.now() / 1000 / WINDOW_SECS)
}

function makeHmac(secret: string, exhibitId: string, w: number): string {
  return createHmac('sha256', secret)
    .update(`${exhibitId}:${w}`)
    .digest('hex')
    .slice(0, 16)
}

export function verifyQr(secret: string, exhibitId: string, w: number, h: string): boolean {
  const now = currentWindow()
  // ±1 ウィンドウ許容（時計ズレ対策）
  return [now - 1, now, now + 1].some(candidate => makeHmac(secret, exhibitId, candidate) === h)
}

export function buildQrUrl(baseUrl: string, exhibitId: string, secret: string): string {
  const w = currentWindow()
  const h = makeHmac(secret, exhibitId, w)
  return `${baseUrl}/stamp?e=${exhibitId}&w=${w}&h=${h}`
}
