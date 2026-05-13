'use client'

/**
 * MapCanvas
 * ──────────────────────────────────────────────────────
 * Three.js (OrthographicCamera + OrbitControls) で GLB を表示。
 * CSS2DRenderer を重ねて「待ち時間円グラフ＋サムネ」を
 * 各教室メッシュの中心にアンカーし、pan/zoom に自動追従させる。
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { GLTFLoader }    from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js'
import { Exhibit } from '@/types'

// ── カラー ──────────────────────────────────────────────
const COLOR = {
  bg:      0xb8e0f7,
  floor:   0xffffff,
  ground:  0xD9B39E,
  unused:  0xd1d5db,
  free:    0x86efac,
  low:     0xfef08a,
  mid:     0xfdba74,
  high:    0xfca5a5,
  selected:0xffec40,
} as const

// 初期カメラオフセット（camera.position.set(-5, 10, 15) に合わせる）
const INIT_CAM_OFFSET = new THREE.Vector3(-5, 10, 15)

const FLOOR_MESH_RE = /^(\d+F|基礎|床|ground)$/i
const GROUND_MESH_RE = /ground/i // "ground" を含むメッシュ用
const waitToColor = (wait: number, assigned: boolean): number => {
  if (!assigned)  return COLOR.unused
  if (wait === 0) return COLOR.free
  if (wait <= 10) return COLOR.low
  if (wait <= 25) return COLOR.mid
  return COLOR.high
}

/** 待ち時間 → マーカーのリングカラー文字列 */
const waitToRingColor = (wait: number): string => {
  if (wait === 0) return '#4ade80'
  if (wait <= 10) return '#facc15'
  if (wait <= 25) return '#fb923c'
  return '#f87171'
}

// ── マーカーDOM生成 ──────────────────────────────────────
// ── アニメーション用CSSの注入 ────────────────────────────
// 画像とテキストを交互に出すためのアニメーションを定義
if (typeof document !== 'undefined') {
  const style = document.createElement('style')
  style.innerHTML = `
    @keyframes marker-fade-in {
      0%, 45% { opacity: 1; visibility: visible; }
      50%, 100% { opacity: 0; visibility: hidden; }
    }
    @keyframes marker-fade-out {
      0%, 45% { opacity: 0; visibility: hidden; }
      50%, 100% { opacity: 1; visibility: visible; }
    }
  `
  document.head.appendChild(style)
}

// ── マーカーDOM生成 ──────────────────────────────────────
function createMarkerEl(exhibit: Exhibit): HTMLElement {
  const waitPct   = Math.min((exhibit.wait_minutes / 60) * 100, 100)
  const ringColor = waitToRingColor(exhibit.wait_minutes)
  const bgTrack   = '#e2e8f0'

  const wrap = document.createElement('div')
  wrap.style.cssText = `
    display: flex;
    flex-direction: column;
    align-items: center;
    pointer-events: none;
    user-select: none;
  `

  const RING = 48
  const PAD  = 3
  const ring = document.createElement('div')
  ring.style.cssText = `
    width: ${RING}px; height: ${RING}px;
    border-radius: 50%;
    padding: ${PAD}px;
    background: conic-gradient(${ringColor} 0% ${waitPct}%, ${bgTrack} ${waitPct}% 100%);
    box-shadow: 0 2px 10px rgba(0,0,0,0.22);
    position: relative;
  `

  const inner = document.createElement('div')
  inner.style.cssText = `
    width: 100%; height: 100%;
    border-radius: 50%;
    background: #fff;
    overflow: hidden;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  `

  // 1. ラベル（展示名/クラス名）
  const labelEl = makeLabelEl(exhibit)
  
  if (exhibit.thumbnail_url) {
    // 画像がある場合：交互に表示
    labelEl.style.position = 'absolute'
    labelEl.style.animation = 'marker-fade-in 6s infinite ease-in-out'

    const img = document.createElement('img')
    img.src = exhibit.thumbnail_url
    img.style.cssText = `
      width:100%; height:100%; object-fit:cover; border-radius:50%;
      position: absolute;
      animation: marker-fade-out 6s infinite ease-in-out;
    `
    inner.appendChild(img)
    inner.appendChild(labelEl)
  } else {
    // 画像がない場合：ラベルのみ常時表示
    inner.appendChild(labelEl)
  }

  ring.appendChild(inner)

  const tip = document.createElement('div')
  tip.style.cssText = `
    width: 0; height: 0;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid ${ringColor};
    margin-top: -1px;
  `

  wrap.appendChild(ring)
  wrap.appendChild(tip)
  return wrap
}

function makeLabelEl(exhibit: Exhibit): HTMLElement {
  const raw = exhibit.class_label ?? exhibit.name
  const wrap = document.createElement('div')
  wrap.style.cssText = `
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    width: 100%; line-height: 1.1; padding: 2px;
    text-align: center;
  `

  if (raw.length <= 4) {
    const s = document.createElement('span')
    s.textContent = raw
    const fontSize = raw.length <= 3 ? '11px' : '10px'
    s.style.cssText = `
      font-size: ${fontSize}; font-weight: 900; color: #ea580c;
      font-family: 'Kaisei Decol', serif;
    `
    wrap.appendChild(s)
  } else {
    const match = raw.match(/^([高中]\d+)(-\d+.*)$/)
    const line1Text = match ? match[1] : raw.slice(0, 3)
    const line2Text = match ? match[2] : raw.slice(3)
    const commonStyle = `
      font-size: 9px; font-weight: 900; color: #ea580c;
      font-family: 'Kaisei Decol', serif; white-space: nowrap;
    `
    const s1 = document.createElement('span')
    s1.textContent = line1Text
    s1.style.cssText = commonStyle
    wrap.appendChild(s1)
    if (line2Text) {
      const s2 = document.createElement('span')
      s2.textContent = line2Text
      s2.style.cssText = commonStyle
      wrap.appendChild(s2)
    }
  }
  return wrap
}
// ── メインコンポーネント ─────────────────────────────────
interface MapCanvasProps {
  floor: number
  exhibits: Exhibit[]
  searchQuery?: string
  focusRoom?:   string | null
  onRoomClick: (nodeName: string) => void
}

interface FocusAnim {
  active:      boolean
  startTarget: THREE.Vector3
  endTarget:   THREE.Vector3
  startCamPos: THREE.Vector3
  endCamPos:   THREE.Vector3
  startZoom:   number
  endZoom:     number
  t:           number
}

export default function MapCanvas({
  floor,
  exhibits,
  searchQuery = '',
  focusRoom   = null,
  onRoomClick,
}: MapCanvasProps) {
  const mountRef      = useRef<HTMLDivElement>(null)
  const rendererRef   = useRef<THREE.WebGLRenderer | null>(null)
  const css2dRef      = useRef<CSS2DRenderer | null>(null)
  const sceneRef      = useRef<THREE.Scene | null>(null)
  const cameraRef     = useRef<THREE.OrthographicCamera | null>(null)
  const controlsRef   = useRef<OrbitControls | null>(null)
  const rafRef        = useRef<number>(0)
  const roomMeshes    = useRef<Map<string, THREE.Mesh>>(new Map())
  const css2dObjects  = useRef<CSS2DObject[]>([])
  const pointerStart        = useRef({ x: 0, y: 0 })
  const onRoomClickRef      = useRef(onRoomClick)
  const focusAnimRef        = useRef<FocusAnim | null>(null)
  const hasFocusedRef       = useRef(false)
  const applyRoomColorsRef  = useRef<() => void>(() => {})
  const rebuildMarkersRef   = useRef<(scene: THREE.Scene) => void>(() => {})

  useEffect(() => {
    onRoomClickRef.current = onRoomClick
  }, [onRoomClick])

  const exhibitMap = useMemo(
    () => Object.fromEntries(exhibits.map((e) => [e.room_object ?? '', e])),
    [exhibits]
  )

  // ── メッシュカラー適用 ──────────────────────────────────
  const applyRoomColors = useCallback(() => {
    roomMeshes.current.forEach((mesh, name) => {
      const exhibit  = exhibitMap[name]
      const assigned = !!exhibit
      const wait     = exhibit?.wait_minutes ?? 0
      const q    = searchQuery.toLowerCase()
      const isHL = q.length > 0 && (
        exhibit?.name.toLowerCase().includes(q) ||
        exhibit?.class_label?.toLowerCase().includes(q)
      )
      const hex = isHL ? COLOR.selected : waitToColor(wait, assigned)
      ;(mesh.material as THREE.MeshLambertMaterial).color.setHex(hex)
    })
  }, [exhibitMap, searchQuery])

  // ── CSS2D マーカーを再生成 ──────────────────────────────
  const rebuildMarkers = useCallback((scene: THREE.Scene) => {
    css2dObjects.current.forEach((obj) => obj.parent?.remove(obj))
    css2dObjects.current = []

    roomMeshes.current.forEach((mesh, name) => {
      const exhibit = exhibitMap[name]
      if (!exhibit) return

      // ★ getWorldPosition でワールド座標を正確に取得
      //    （GLBごとのscale/translationを正しく反映）
      const worldPos = new THREE.Vector3()
      mesh.getWorldPosition(worldPos)

      // メッシュのワールド空間バウンディングボックス（高さ取得用）
      const box    = new THREE.Box3().setFromObject(mesh)
      const topY   = box.max.y  // 教室天井のY座標

      const el    = createMarkerEl(exhibit)
      const css2d = new CSS2DObject(el)
      // XZ は教室中心、Y は天井の少し上
      css2d.position.set(worldPos.x, topY + 0.05, worldPos.z)
      scene.add(css2d)
      css2dObjects.current.push(css2d)
    })
  }, [exhibitMap])

  // ref を常に最新に保つ（loadFloor の deps から外すため）
  useEffect(() => { applyRoomColorsRef.current = applyRoomColors }, [applyRoomColors])
  useEffect(() => { rebuildMarkersRef.current  = rebuildMarkers  }, [rebuildMarkers])

  // ── GLBロード ───────────────────────────────────────────
  const loadFloor = useCallback((scene: THREE.Scene, f: number) => {
    // 前フロアを削除
    roomMeshes.current.clear()
    css2dObjects.current.forEach((o) => o.parent?.remove(o))
    css2dObjects.current = []
    const prev = scene.getObjectByName('floorModel')
    if (prev) scene.remove(prev)

    const loader = new GLTFLoader()
    loader.load(
      `/models/schoolmap_${f}F.glb`,
      (gltf) => {
        const root = gltf.scene
        root.name  = 'floorModel'

        // 中央揃え
        const box = new THREE.Box3().setFromObject(root)
        root.position.sub(box.getCenter(new THREE.Vector3()))

        root.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh)) return

          const isFloor = FLOOR_MESH_RE.test(obj.name) ||
                          obj.name === `${f}F`         ||
                          obj.name.includes('床')
          const isGround = GROUND_MESH_RE.test(obj.name)
          
          // MeshLambertMaterial: シンプルで縞アーチファクトが出ない
          obj.material = new THREE.MeshLambertMaterial({
            color: isFloor ? COLOR.floor : COLOR.unused,
          })
          obj.castShadow    = false
          obj.receiveShadow = false
                    // 色の決定: 地面なら soil、床なら floor、それ以外(教室)なら一旦 unused
          let meshColor:number = COLOR.unused
          if (isGround) {
            meshColor = COLOR.ground
          } else if (isFloor) {
            meshColor = COLOR.floor
          }
          obj.material = new THREE.MeshLambertMaterial({ color: meshColor })
          obj.castShadow    = false
          obj.receiveShadow = false

          // 教室メッシュ（地面でも床でもないもの）を登録
          if (!isGround && !isFloor) {
            roomMeshes.current.set(obj.name, obj)
          }
          
        })

        scene.add(root)
        // ★ ワールド行列を強制更新してからマーカー位置を計算する
        //    （各GLBのscale/translationがマトリクスに反映される）
        scene.updateMatrixWorld(true)
        applyRoomColorsRef.current()
        rebuildMarkersRef.current(scene)

        // カメラフィット
        const fittedBox = new THREE.Box3().setFromObject(root)
        const size      = fittedBox.getSize(new THREE.Vector3())
        const cam       = cameraRef.current
        const renderer  = rendererRef.current
        if (cam && renderer) {
          const maxDim = Math.max(size.x, size.z) * 0.65
          const aspect = renderer.domElement.clientWidth / renderer.domElement.clientHeight
          cam.left   = -maxDim * aspect
          cam.right  =  maxDim * aspect
          cam.top    =  maxDim
          cam.bottom = -maxDim
          cam.zoom   = 1
          cam.updateProjectionMatrix()
        }
      },
      undefined,
      (err) => console.error(`GLB load error (${f}F):`, err)
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Three.js 初期化（マウント時1回）──────────────────────
  useEffect(() => {
    if (!mountRef.current || rendererRef.current) return
    const el = mountRef.current
    const W  = el.clientWidth
    const H  = el.clientHeight

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(W, H)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(COLOR.bg)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    // シャドウ不要（shadow acne による縞を防ぐ）
    renderer.shadowMap.enabled = false
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // CSS2D Renderer（WebGLの上に重ねる）
    const css2d = new CSS2DRenderer()
    css2d.setSize(W, H)
    css2d.domElement.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      pointer-events: none;
      overflow: hidden;
    `
    el.appendChild(css2d.domElement)
    css2dRef.current = css2d

    // Scene & Lights（シャドウなし、均一なアイソメトリック照明）
    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xffffff, 2.2))
    const sun = new THREE.DirectionalLight(0xffffff, 0.6)
    sun.position.set(15, 30, 20)
    sun.castShadow = false
    scene.add(sun)
    sceneRef.current = scene

    // OrthographicCamera（アイソメトリック）
    const aspect = W / H
    const d = 6
    const camera = new THREE.OrthographicCamera(
      -d * aspect, d * aspect, d, -d, 0.1, 2000
    )
    camera.position.set(-5, 10, 15)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    // OrbitControls（回転無効、pan/zoom のみ）
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableRotate  = false
    controls.enableDamping = true
    controls.dampingFactor = 0.1
    controls.mouseButtons  = {
      LEFT:   THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN,
    }
    controls.touches = {
      ONE: THREE.TOUCH.PAN,
      TWO: THREE.TOUCH.DOLLY_PAN,
    }
    controlsRef.current = controls

    // アニメーションループ
    let rafId = 0
    const animate = () => {
      rafId = requestAnimationFrame(animate)
      controls.update()

      // フォーカスアニメーション（target + camera.position を同時に動かして初期角度を維持）
      const fa = focusAnimRef.current
      if (fa?.active) {
        fa.t += 0.05
        if (fa.t >= 1) { fa.t = 1; fa.active = false }
        const eased = 1 - Math.pow(1 - fa.t, 3) // ease-out cubic
        controls.target.lerpVectors(fa.startTarget, fa.endTarget, eased)
        camera.position.lerpVectors(fa.startCamPos, fa.endCamPos, eased)
        camera.zoom = fa.startZoom + (fa.endZoom - fa.startZoom) * eased
        camera.updateProjectionMatrix()
      }

      renderer.render(scene, camera)
      css2d.render(scene, camera)
    }
    animate()
    rafRef.current = rafId

    // タップ判定（移動5px未満をタップと見なす）
    const onPointerDown = (e: PointerEvent) => {
      pointerStart.current = { x: e.clientX, y: e.clientY }
    }
    const onPointerUp = (e: PointerEvent) => {
      const dx = e.clientX - pointerStart.current.x
      const dy = e.clientY - pointerStart.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) return

      const rect   = el.getBoundingClientRect()
      const mouse  = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(mouse, camera)
      const hits = raycaster.intersectObjects(
        Array.from(roomMeshes.current.values()), true
      )
      if (hits.length > 0) {
        let obj: THREE.Object3D = hits[0].object
        while (obj.parent && !roomMeshes.current.has(obj.name)) {
          obj = obj.parent
        }
        onRoomClickRef.current(obj.name)
      } else if (hasFocusedRef.current) {
        // フォーカス中に空白タップ → カメラを初期状態へリセット
        hasFocusedRef.current = false
        focusAnimRef.current = {
          active:      true,
          startTarget: controls.target.clone(),
          endTarget:   new THREE.Vector3(0, 0, 0),
          startCamPos: camera.position.clone(),
          endCamPos:   INIT_CAM_OFFSET.clone(),
          startZoom:   camera.zoom,
          endZoom:     1,
          t:           0,
        }
      }
    }
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup',   onPointerUp)

    // リサイズ
    const ro = new ResizeObserver(() => {
      const W2 = el.clientWidth
      const H2 = el.clientHeight
      renderer.setSize(W2, H2)
      css2d.setSize(W2, H2)
      const asp = W2 / H2
      const halfH = (camera.top - camera.bottom) / 2
      camera.left   = -halfH * asp
      camera.right  =  halfH * asp
      camera.updateProjectionMatrix()
    })
    ro.observe(el)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      if (el.contains(css2d.domElement))    el.removeChild(css2d.domElement)
      rendererRef.current = null
      css2dRef.current    = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // フロア変更
  useEffect(() => {
    if (sceneRef.current) loadFloor(sceneRef.current, floor)
  }, [floor, loadFloor])

  // exhibits / searchQuery 変更 → 色だけ更新
  useEffect(() => {
    applyRoomColors()
  }, [applyRoomColors])

  // exhibits 変更 → マーカーも再生成
  useEffect(() => {
    if (sceneRef.current) rebuildMarkers(sceneRef.current)
  }, [rebuildMarkers])

  // focusRoom 変更 → カメラをスムーズに移動・ズーム
  useEffect(() => {
    if (!focusRoom) return

    const tryFocus = () => {
      const mesh = roomMeshes.current.get(focusRoom)
      if (!mesh || !controlsRef.current || !cameraRef.current) return false

      const worldPos = new THREE.Vector3()
      mesh.getWorldPosition(worldPos)

      const endTarget = new THREE.Vector3(worldPos.x, 0, worldPos.z)
      hasFocusedRef.current = true
      focusAnimRef.current = {
        active:      true,
        startTarget: controlsRef.current.target.clone(),
        endTarget,
        startCamPos: cameraRef.current.position.clone(),
        endCamPos:   endTarget.clone().add(INIT_CAM_OFFSET),
        startZoom:   cameraRef.current.zoom,
        endZoom:     2.5,
        t:           0,
      }
      return true
    }

    // フロア切り替え直後はメッシュ未ロードのためリトライ
    if (!tryFocus()) {
      const timer = setTimeout(tryFocus, 800)
      return () => clearTimeout(timer)
    }
  }, [focusRoom, floor])

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 overflow-hidden"
      style={{ touchAction: 'none' }}
    />
  )
}
