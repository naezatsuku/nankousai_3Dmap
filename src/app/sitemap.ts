import { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://nankousai-3d-map.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url:             SITE_URL,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        1,
    },
    {
      url:             `${SITE_URL}/map`,
      lastModified:    new Date(),
      changeFrequency: 'hourly',
      priority:        0.9,
    },
    {
      url:             `${SITE_URL}/news`,
      lastModified:    new Date(),
      changeFrequency: 'hourly',
      priority:        0.8,
    },
    {
      url:             `${SITE_URL}/band`,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        0.7,
    },
    {
      url:             `${SITE_URL}/food`,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        0.7,
    },
    {
      url:             `${SITE_URL}/special`,
      lastModified:    new Date(),
      changeFrequency: 'daily',
      priority:        0.7,
    },
    {
      url:             `${SITE_URL}/notifications`,
      lastModified:    new Date(),
      changeFrequency: 'monthly',
      priority:        0.4,
    },
  ]
}
