import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'フード',
  description: '南高祭のフード・屋台情報。メニュー・価格・販売状況をリアルタイムで確認。',
  openGraph: {
    title: 'フード | 南高祭',
    description: '南高祭のフード・屋台情報。メニュー・価格・販売状況をリアルタイムで確認。',
  },
}

export default function FoodLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
