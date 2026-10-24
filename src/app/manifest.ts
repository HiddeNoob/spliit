import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Spliit',
    short_name: 'Spliit',
    description:
      'A minimalist web application to share expenses with friends and family. No ads, no account, no problem.',
    start_url: '/groups',
    scope: '/',
    id: '/groups',
    display: 'standalone',
    display_override: ['standalone', 'minimal-ui'],
    orientation: 'portrait-primary',
    lang: 'en',
    dir: 'ltr',
    categories: ['finance', 'productivity', 'utilities'],
    prefer_related_applications: false,
    background_color: '#fff',
    theme_color: '#047857',
    shortcuts: [
      {
        name: 'New expense',
        short_name: 'Expense',
        description: 'Open your groups to add an expense',
        url: '/groups',
        icons: [{ src: '/logo/192x192.png', sizes: '192x192' }],
      },
      {
        name: 'Recent groups',
        short_name: 'Groups',
        description: 'See your recent groups',
        url: '/groups',
        icons: [{ src: '/logo/192x192.png', sizes: '192x192' }],
      },
    ],
    icons: [
      {
        src: '/logo/48x48.png',
        sizes: '48x48',
        type: 'image/png',
      },
      {
        src: '/logo/64x64.png',
        sizes: '64x64',
        type: 'image/png',
      },
      {
        src: '/logo/128x128.png',
        sizes: '128x128',
        type: 'image/png',
      },
      {
        src: '/logo/144x144.png',
        sizes: '144x144',
        type: 'image/png',
      },
      {
        src: '/logo/192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo/256x256.png',
        sizes: '256x256',
        type: 'image/png',
      },
      {
        src: '/logo/512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/logo/512x512-maskable.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
