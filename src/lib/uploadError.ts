/**
 * Supabase Storage のエラーオブジェクトを日本語メッセージに変換する
 * statusCode は文字列 ("413", "507" など)
 */
export function parseUploadError(e: unknown): string {
  if (e && typeof e === 'object') {
    const status = (e as Record<string, unknown>).statusCode as string | undefined
    if (status === '413') return 'ファイルサイズが大きすぎます（ストレージの上限を超えています）'
    if (status === '507') return 'ストレージの空き容量が不足しています'
    if (status === '403') return 'アップロードの権限がありません'
    if (e instanceof Error && e.message) return e.message
    const msg = (e as Record<string, unknown>).message as string | undefined
    if (msg) return msg
  }
  return 'アップロードに失敗しました'
}
