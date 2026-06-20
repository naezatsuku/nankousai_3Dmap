/**
 * roomObjects
 * ──────────────────────────────────────────────────────
 * フロア GLB から「教室メッシュ（room_object 候補）」の名前一覧を取得する。
 * 床・地面メッシュの判定は MapCanvas の登録ロジックと揃えてある。
 */

import * as THREE from 'three'
import { getFloorModel } from './glbPreload'

const FLOOR_MESH_RE = /^(\d+F|基礎|床|ground)$/i
const GROUND_MESH_RE = /ground/i

export async function getRoomObjectNames(floor: number): Promise<string[]> {
  const root = await getFloorModel(floor)
  const names: string[] = []

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const isFloor = FLOOR_MESH_RE.test(obj.name) || obj.name === `${floor}F` || obj.name.includes('床')
    const isGround = GROUND_MESH_RE.test(obj.name)
    if (!isFloor && !isGround) names.push(obj.name)
  })

  return names.sort((a, b) => a.localeCompare(b, 'ja', { numeric: true }))
}
