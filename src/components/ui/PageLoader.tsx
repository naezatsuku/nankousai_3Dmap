'use client'

/**
 * データ取得中に表示するローディング UI
 * NavigationLoader と同じビジュアルを転用
 */
export default function PageLoader() {
  return (
    <>
      <style>{`
        @keyframes pl-spin  { to { transform: rotate(360deg); } }
        @keyframes pl-dot   { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes pl-pop   { 0%{transform:scale(.5);opacity:0} 60%{transform:scale(1.15)} 100%{transform:scale(1);opacity:1} }
      `}</style>

      {/* 右下ミニなんぺん（NavigationLoader と同じ） */}
      <div style={{
        position: 'fixed',
        bottom: 80, right: 16,
        zIndex: 9000,
        pointerEvents: 'none',
        animation: 'pl-pop 0.3s cubic-bezier(0.34,1.3,0.64,1) forwards',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      }}>
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: 'rgba(255,255,255,0.95)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1.5px solid rgba(255,140,0,0.2)',
        }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nanpen.png"
            alt=""
            style={{ width: 30, height: 30, objectFit: 'contain', animation: 'pl-spin 1s linear infinite' }}
          />
        </div>
        <div style={{ display: 'flex', gap: 3 }}>
          {[0, 1, 2].map(i => (
            <div key={i} style={{
              width: 5, height: 5, borderRadius: '50%', background: '#FF8C00',
              animation: `pl-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    </>
  )
}
