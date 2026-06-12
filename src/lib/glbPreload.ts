/**
 * glbPreload
 * ──────────────────────────────────────────────────────
 * フロア GLB のプリロード＆パース結果キャッシュ。
 * トップページのなんぺんローディング中に preloadAllFloors() を
 * 呼んでおくことで、マップ表示・フロア切替時の
 * フェッチ＋パース（メインスレッドの長タスク）を排除する。
 *
 * モジュールスコープのキャッシュは Next.js のクライアント
 * ナビゲーションをまたいで生存するため、マップページを
 * 離れて戻ってきても再パースは発生しない。
 */

import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export const FLOORS = [1, 2, 3, 4, 5, 6]

const cache = new Map<number, Promise<THREE.Group>>()

/** パース済みシーンを取得（未ロードならロード開始）。結果はキャッシュ共有 */
function loadFloorScene(floor: number): Promise<THREE.Group> {
  let p = cache.get(floor)
  if (!p) {
    p = new GLTFLoader()
      .loadAsync(`/models/schoolmap_${floor}F.glb`)
      .then(gltf => gltf.scene)
    // 失敗したらキャッシュから外して次回リトライ可能にする
    p.catch(() => cache.delete(floor))
    cache.set(floor, p)
  }
  return p
}

/**
 * 表示用モデルを取得。
 * 呼び出し側（MapCanvas）が position やマテリアルを書き換えるため、
 * キャッシュ本体は触らせずクローンを返す（ジオメトリは共有される）。
 */
export async function getFloorModel(floor: number): Promise<THREE.Group> {
  const scene = await loadFloorScene(floor)
  return scene.clone(true)
}

/**
 * 全フロアを順次プリロード。first（初期表示フロア）を最優先。
 * 直列ロードにして、ローディング演出中のメインスレッドを塞がない。
 */
export async function preloadAllFloors(first = 2): Promise<void> {
  const order = [first, ...FLOORS.filter(f => f !== first)]
  for (const f of order) {
    try {
      await loadFloorScene(f)
    } catch {
      // 個別の失敗は無視（実際の表示時に再リトライされる）
    }
  }
}
