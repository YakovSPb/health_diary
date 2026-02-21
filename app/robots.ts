import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXTAUTH_URL ?? 'https://diabalance.vercel.app';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/diary', '/profile', '/history', '/analysis'],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
