# 3Dマップ カメラの向き（固定値ドキュメント）

[`src/components/map/MapCanvas.tsx`](../src/components/map/MapCanvas.tsx) で使用している
カメラの向きを、現状の固定設定から書き出したものです。

## 前提

- カメラ種別: `THREE.OrthographicCamera`（アイソメトリック）
- 回転は**無効**（`controls.enableRotate = false`）。ユーザー操作は pan / zoom のみ。
  そのため視線の向き（angle）は常に一定で、下記の2状態のみを取ります。
- 座標系: three.js 標準（右手系・+Y が上・前方は −Z）

## 1. 通常視点（初期表示・空白タップでのリセット・教室フォーカス時）

カメラは注視点（`controls.target`）に対して
`INIT_CAM_OFFSET = (-5, 10, 15)` のオフセットを保ったまま移動します。

| 項目 | 値 |
| --- | --- |
| カメラオフセット | `(-5, 10, 15)` |
| 注視点（初期） | `(0, 0, 0)` |
| 視線ベクトル（カメラ→注視点） | `(5, -10, -15)` |
| 視線ベクトル長 | √350 ≈ 18.708 |
| 正規化視線ベクトル | `(0.267, -0.535, -0.802)` |
| 水平面(XZ)成分 | `(5, -15)`（長さ √250 ≈ 15.811） |
| **俯角（水平からの下向き角）** | atan(10 / 15.811) ≈ **32.31°** |
| **方位角（−Z前方→+X方向の回転）** | atan2(5, 15) ≈ **18.43°** |
| 極角（+Y軸からの角度） | acos(0.535) ≈ 57.69° |

## 2. 俯瞰視点（俯瞰トグル ON）

`handleTopDownToggle` で、注視点の真上からほぼ垂直に見下ろします。

| 項目 | 値 |
| --- | --- |
| カメラ位置 | `(target.x, 28, target.z + 0.001)` |
| 注視点 | `(target.x, 0, target.z)` |
| 視線ベクトル（カメラ→注視点） | ≈ `(0, -28, -0.001)` → ほぼ真下（−Y） |
| **俯角** | ≈ **89.998°（ほぼ90°・真上から）** |

> 補足: `target.z + 0.001` の微小オフセットは、視線が完全な −Y になると
> OrbitControls の up ベクトル（+Y）と平行になりジンバルロックするのを避けるためのもの。

## 算出根拠（参照コード）

- 初期カメラ: [`MapCanvas.tsx:486-487`](../src/components/map/MapCanvas.tsx#L486-L487)
  （`camera.position.set(-5, 10, 15)` / `camera.lookAt(0, 0, 0)`）
- オフセット定数: [`MapCanvas.tsx:34`](../src/components/map/MapCanvas.tsx#L34)
- 俯瞰トグル: [`MapCanvas.tsx:288-291`](../src/components/map/MapCanvas.tsx#L288-L291)
- 回転無効化: [`MapCanvas.tsx:492`](../src/components/map/MapCanvas.tsx#L492)
