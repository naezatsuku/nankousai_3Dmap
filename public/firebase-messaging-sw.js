importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

// /api/* は常にネットワークから取得し、キャッシュしない
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }))
  }
})

firebase.initializeApp({
  apiKey:            'AIzaSyBjZY62GEzU4L38-UV7AviFx5oBo1RRUNc',
  authDomain:        'nankousai-8dc09.firebaseapp.com',
  projectId:         'nankousai-8dc09',
  storageBucket:     'nankousai-8dc09.firebasestorage.app',
  messagingSenderId: '806379992694',
  appId:             '1:806379992694:web:3ed94ddce628b047e21157',
})

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  // onBackgroundMessage を登録した場合、表示は常にここで行う（SDK は自動表示しない）
  // tag: 'nankosai-push' により同タグの通知は上書きされ重複表示を防ぐ
  console.log('[SW] onBackgroundMessage payload.data:', JSON.stringify(payload.data))
  const title = payload.notification?.title ?? payload.data?.title ?? '南高祭'
  const body  = payload.notification?.body  ?? payload.data?.body  ?? ''
  const icon  = payload.data?.icon || '/nanpen.png'
  // Promise を return することで SDK 側の waitUntil に渡し、SW が途中終了するのを防ぐ
  return self.registration.showNotification(title, {
    body,
    icon,
    badge: '/nanpen.png',
    tag:   'nankosai-push',
  })
})