import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nankousai-3d-map.vercel.app'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             '南高祭 公式サイト',
    short_name:       '南高祭',
    description:      '南高校の文化祭「南高祭」公式サイト。3Dマップ・展示・フード・バンド情報を確認できます。',
    start_url:        '/',
    scope:            '/',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#FF8C00',
    orientation:      'portrait-primary',
    lang:             'ja',
    categories:       ['education', 'entertainment'],
    // getInstalledRelatedApps() で PWA インストール検出に使用
    related_applications: [
      {
        platform: 'webapp',
        url:      `${SITE_URL}/manifest.webmanifest`,
      },
    ],
    icons: [
      {
        src:     '/nanpen.png',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/nanpen.png',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }
}