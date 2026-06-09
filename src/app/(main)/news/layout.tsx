import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'お知らせ',
  description: '南高祭の最新情報・アナウンス。当日のスケジュール変更や重要なお知らせをチェック。',
  openGraph: {
    title: 'お知らせ | 南高祭',
    description: '南高祭の最新情報・アナウンス。当日のスケジュール変更や重要なお知らせをチェック。',
  },
}

export default function NewsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
