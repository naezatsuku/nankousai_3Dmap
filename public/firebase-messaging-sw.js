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
  const { title, body } = payload.notification ?? {}
  self.registration.showNotification(title ?? '南高祭', {
    body:  body ?? '',
    icon:  '/nanpen.png',
    badge: '/nanpen.png',
    tag:   'nankosai-push',
  })
})
