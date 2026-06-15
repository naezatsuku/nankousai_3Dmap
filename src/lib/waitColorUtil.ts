export interface WaitConfig {
  stageCount: number   // 3 | 4 | 5
  thresholds: number[] // length = stageCount - 2
}

/** CSS ring / text colors per non-zero slot */
export const SLOT_CSS: Record<number, readonly string[]> = {
  3: ['#facc15', '#f87171'],
  4: ['#facc15', '#fb923c', '#f87171'],
  5: ['#a3e635', '#facc15', '#fb923c', '#f87171'],
}

/** Three.js mesh hex colors per non-zero slot */
export const SLOT_HEX: Record<number, readonly number[]> = {
  3: [0xfef08a, 0xfca5a5],
  4: [0xfef08a, 0xfdba74, 0xfca5a5],
  5: [0xecfccb, 0xfef08a, 0xfdba74, 0xfca5a5],
}

/** Stage label arrays (index 0 = 空き) */
export const STAGE_LABELS: Record<number, readonly string[]> = {
  3: ['空き', '混雑', '大混雑'],
  4: ['空き', 'やや混雑', '混雑', '大混雑'],
  5: ['空き', '空き気味', 'やや混雑', '混雑', '大混雑'],
}

/** CSS color for a given wait time and config */
export function waitCssColor(wait: number, config: WaitConfig): string {
  if (wait === 0) return '#4ade80'
  const colors = SLOT_CSS[config.stageCount] ?? SLOT_CSS[4]
  for (let i = 0; i < config.thresholds.length; i++) {
    if (wait <= config.thresholds[i]) return colors[i]
  }
  return colors[colors.length - 1]
}

/** Three.js hex color for a given wait time and config */
export function waitHexColor(wait: number, assigned: boolean, config: WaitConfig): number {
  if (!assigned) return 0xd1d5db
  if (wait === 0) return 0x86efac
  const colors = SLOT_HEX[config.stageCount] ?? SLOT_HEX[4]
  for (let i = 0; i < config.thresholds.length; i++) {
    if (wait <= config.thresholds[i]) return colors[i]
  }
  return colors[colors.length - 1]
}

/** Build the active thresholds array from raw DB values */
export function buildThresholds(
  stageCount: number,
  th1: number,
  th2: number,
  th3: number,
): number[] {
  return [th1, th2, th3].slice(0, stageCount - 2)
}

/** Progress bar gradient: green → colors up to the current wait level */
export function waitBarGradient(wait: number, config: WaitConfig): string {
  if (wait === 0) return '#4ade80'
  const colors = SLOT_CSS[config.stageCount] ?? SLOT_CSS[4]
  let slotIndex = colors.length - 1
  for (let i = 0; i < config.thresholds.length; i++) {
    if (wait <= config.thresholds[i]) { slotIndex = i; break }
  }
  const stops = ['#4ade80', ...colors.slice(0, slotIndex + 1)]
  return `linear-gradient(90deg, ${stops.join(', ')})`
}

export const DEFAULT_WAIT_CONFIG: WaitConfig = {
  stageCount: 4,
  thresholds: [10, 25],
}
