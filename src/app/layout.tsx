import type { Metadata, Viewport } from 'next'
import './globals.css'
import ErudaLoader from '@/components/ui/ErudaLoader'

// ── 本番URLをここに設定（OGP・canonical に使用）──────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nankousai.example.com'
const YEAR     = new Date().getFullYear()

export const viewport: Viewport = {
  themeColor:    '#FF8C00',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  `南高祭${YEAR} | 南高校 文化祭公式サイト`,
    template: `%s | 南高祭${YEAR}`,
  },
  description: `南高校の文化祭「南高祭${YEAR}」公式サイト。3Dマップで会場を探したり、展示・フード・バンド・催しのスケジュールをチェックできます。`,
  keywords:    ['南高祭', '南高校', '文化祭', `${YEAR}`, '学校祭', '展示', 'バンド', 'フード'],
  authors:     [{ name: '南高祭実行委員会' }],

  openGraph: {
    type:        'website',
    locale:      'ja_JP',
    url:         SITE_URL,
    siteName:    `南高祭${YEAR}`,
    title:       `南高祭${YEAR} | 南高校 文化祭公式サイト`,
    description: `南高校の文化祭「南高祭${YEAR}」公式サイト。3Dマップで会場を探したり、展示・フード・バンド・催しのスケジュールをチェックできます。`,
    images: [{
      url:    '/og-image.png',
      width:  1200,
      height: 630,
      alt:    `南高祭${YEAR}`,
    }],
  },

  twitter: {
    card:        'summary_large_image',
    title:       `南高祭${YEAR} | 南高校 文化祭公式サイト`,
    description: `南高校の文化祭「南高祭${YEAR}」公式サイト。`,
    images:      ['/og-image.png'],
  },

  icons: {
    icon:     [{ url: '/nanpen.png', type: 'image/png' }],
    shortcut: '/nanpen.png',
    apple:    '/nanpen.png',
  },

  manifest: '/manifest.webmanifest',

  verification: {
    google: '7916912ea099b7bf',
  },

  appleWebApp: {
    capable:        true,
    statusBarStyle: 'default',
    title:          '南高祭',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className="h-full">
      <head>
        {/* Google Fonts — 実際に使用しているフォント */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kaisei+Decol:wght@400;700&family=Kiwi+Maru:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        {process.env.NODE_ENV === 'development' && <ErudaLoader />}
        <script dangerouslySetInnerHTML={{ __html: `
          document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
          document.addEventListener('dragstart', function(e) { if (e.target.tagName === 'IMG') e.preventDefault(); });
        `}} />
      </body>
    </html>
  )
}
