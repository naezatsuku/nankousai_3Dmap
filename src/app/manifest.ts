import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             '南高祭',
    short_name:       '南高祭',
    description:      '南高祭 公式サイト',
    start_url:        '/map',
    display:          'standalone',
    background_color: '#ffffff',
    theme_color:      '#FF8C00',
    orientation:      'portrait',
    icons: [
      {
        src:   '/nanpen.png',
        sizes: 'any',
        type:  'image/png',
      },
    ],
  }
}