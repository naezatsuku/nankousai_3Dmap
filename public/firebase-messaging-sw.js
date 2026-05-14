importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey:            'AIzaSyBjZY62GEzU4L38-UV7AviFx5oBo1RRUNc',
  authDomain:        'nankousai-8dc09.firebaseapp.com',
  projectId:         'nankousai-8dc09',
  storageBucket:     'nankousai-8dc09.firebasestorage.app',
  messagingSenderId: '806379992694',
  appId:             '1:806379992694:web:3ed94ddce628b047e21157',
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage(payload => {
  // onBackgroundMessage を登録した場合、表示は常にここで行う（SDK は自動表示しない）
  // tag: 'nankosai-push' により同タグの通知は上書きされ重複表示を防ぐ
  const title = payload.notification?.title ?? payload.data?.title ?? '南高祭'
  const body  = payload.notification?.body  ?? payload.data?.body  ?? ''
  self.registration.showNotification(title, {
    body,
    icon:  '/nanpen.png',
    badge: '/nanpen.png',
    tag:   'nankosai-push',
  })
})