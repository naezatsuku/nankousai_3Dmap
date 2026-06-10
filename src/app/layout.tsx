import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import ErudaLoader   from '@/components/ui/ErudaLoader'
import TokenLinker   from '@/components/ui/TokenLinker'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'

// ── 本番URLをここに設定（OGP・canonical に使用）──────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nankousai-3d-map.vercel.app'
const YEAR     = new Date().getFullYear()

const EVENT_JSON_LD = {
  '@context':           'https://schema.org',
  '@type':              'Event',
  name:                 `南高祭${YEAR}`,
  description:          `横浜市立南高等学校・附属中学校の文化祭「南高祭${YEAR}」。展示・フード・軽音楽部・スペシャルパフォーマンスをお楽しみください。`,
  startDate:            `${YEAR}-09-12T09:00:00+09:00`,
  endDate:              `${YEAR}-09-13T16:30:00+09:00`,
  eventStatus:          'https://schema.org/EventScheduled',
  eventAttendanceMode:  'https://schema.org/OfflineEventAttendanceMode',
  location: {
    '@type': 'Place',
    name:    '横浜市立南高等学校・附属中学校',
    address: {
      '@type':           'PostalAddress',
      streetAddress:     '東永谷二丁目1-1',
      addressLocality:   '横浜市港南区',
      addressRegion:     '神奈川県',
      addressCountry:    'JP',
    },
  },
  organizer: {
    '@type': 'Organization',
    name:    '南高祭実行委員会',
    url:     SITE_URL,
  },
  url: SITE_URL,
}

export const viewport: Viewport = {
  themeColor:    '#FF8C00',
  width:         'device-width',
  initialScale:  1,
  maximumScale:  1,
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),

  title: {
    default:  `南高祭${YEAR} | 横浜市立南高等学校 文化祭公式サイト`,
    template: `%s | 南高祭${YEAR}`,
  },
  description: `横浜市立南高等学校・附属中学校の文化祭「南高祭${YEAR}」公式サイト。9月12日・13日開催。3Dマップで会場を探したり、展示・フード・バンド・催しのスケジュールをチェックできます。`,
  keywords:    ['南高祭', '南高校', '横浜市立南高等学校', '文化祭', `${YEAR}`, '学校祭', '展示', 'バンド', 'フード', '横浜', '港南区'],
  authors:     [{ name: '南高祭実行委員会' }],

  openGraph: {
    type:        'website',
    locale:      'ja_JP',
    url:         SITE_URL,
    siteName:    `南高祭${YEAR}`,
    title:       `南高祭${YEAR} | 横浜市立南高等学校 文化祭公式サイト`,
    description: `横浜市立南高等学校・附属中学校の文化祭「南高祭${YEAR}」公式サイト。9月12日・13日開催。3Dマップで会場を探したり、展示・フード・バンド・催しのスケジュールをチェックできます。`,
    images: [{
      url:    '/og-image.png',
      width:  1200,
      height: 630,
      alt:    `南高祭${YEAR}`,
    }],
  },

  twitter: {
    card:        'summary_large_image',
    title:       `南高祭${YEAR} | 横浜市立南高等学校 文化祭公式サイト`,
    description: `横浜市立南高等学校・附属中学校の文化祭「南高祭${YEAR}」公式サイト。9月12日・13日開催。`,
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(EVENT_JSON_LD) }}
        />
        {/* Google Fonts — 実際に使用しているフォント */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Kaisei+Decol:wght@400;700&family=Kiwi+Maru:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <TokenLinker />
        {children}
        {process.env.NODE_ENV === 'development' && <ErudaLoader />}
        <Analytics />
        <SpeedInsights />
        <Script id="prevent-save" strategy="afterInteractive">{`
          document.addEventListener('contextmenu', function(e) { e.preventDefault(); });
          document.addEventListener('dragstart', function(e) { if (e.target.tagName === 'IMG') e.preventDefault(); });
        `}</Script>
        <Script id="prevent-overscroll" strategy="afterInteractive">{`
          /* (main) レイアウト配下のページのみ iOS バウンス無効化 */
          var MAIN_PATHS = ['/map','/notifications','/news','/stamp','/schedule','/vote'];
          document.addEventListener('touchmove', function(e) {
            var path = window.location.pathname;
            var inMain = MAIN_PATHS.some(function(p){ return path.startsWith(p); });
            if (!inMain) return;
            var el = e.target;
            while (el && el !== document.body) {
              var st = window.getComputedStyle(el);
              var oy = st.overflowY;
              if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return;
              el = el.parentElement;
            }
            e.preventDefault();
          }, { passive: false });
        `}</Script>
      </body>
    </html>
  )
}
