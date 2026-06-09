import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '3Dマップ',
  description: '南高祭の会場を3Dマップで探索。各フロアの展示・フード・バンドの場所を確認。',
  openGraph: {
    title: '3Dマップ | 南高祭',
    description: '南高祭の会場を3Dマップで探索。各フロアの展示・フード・バンドの場所を確認。',
  },
}

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
