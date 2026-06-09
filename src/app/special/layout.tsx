import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'スペシャル',
  description: '南高祭のスペシャルパフォーマンス・催し物情報。ステージスケジュールをチェック。',
  openGraph: {
    title: 'スペシャル | 南高祭',
    description: '南高祭のスペシャルパフォーマンス・催し物情報。ステージスケジュールをチェック。',
  },
}

export default function SpecialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
