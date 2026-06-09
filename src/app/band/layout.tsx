import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '軽音楽部',
  description: '南高祭の軽音楽部ライブ情報。バンドのタイムテーブル・出演スケジュールをチェック。',
  openGraph: {
    title: '軽音楽部 | 南高祭',
    description: '南高祭の軽音楽部ライブ情報。バンドのタイムテーブル・出演スケジュールをチェック。',
  },
}

export default function BandLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
