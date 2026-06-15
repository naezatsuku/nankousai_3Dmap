'use client'

import { useRouter } from 'next/navigation'

export default function SiteClosedPage() {
  const router = useRouter()

  return (
    <>
      <style>{`
        @keyframes scFloat {
          0%,100%{ transform: translateY(0); }
          50%     { transform: translateY(-10px); }
        }
        @keyframes scFadeUp {
          from{ opacity:0; transform:translateY(20px); }
          to  { opacity:1; transform:translateY(0); }
        }
      `}</style>
      <div style={{
        minHeight: '100dvh',
        background: 'linear-gradient(160deg,#fff8f0 0%,#ffe8cc 50%,#ffd4a0 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', textAlign: 'center',
        fontFamily: "'Kiwi Maru',serif",
      }}>
        {/* なんぺん */}
        <div style={{ animation: 'scFloat 3.5s ease-in-out infinite', marginBottom: 20 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/nanpen.png"
            alt="なんぺん"
            style={{ width: 120, height: 'auto', filter: 'drop-shadow(0 8px 24px rgba(255,140,0,0.3))' }}
          />
        </div>

        {/* ロックアイコン */}
        <div style={{
          width: 56, height: 56, borderRadius: '50%',
          background: 'rgba(255,107,0,0.12)',
          border: '2px solid rgba(255,107,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, marginBottom: 20,
          animation: 'scFadeUp 0.6s ease both',
        }}>
          🔒
        </div>

        <h1 style={{
          fontFamily: "'Kaisei Decol',serif",
          fontSize: 26, fontWeight: 700,
          color: '#FF6B00', marginBottom: 10,
          animation: 'scFadeUp 0.6s ease 0.1s both',
        }}>
          現在準備中です
        </h1>

        <p style={{
          fontSize: 13, color: '#b36800', lineHeight: 1.9,
          maxWidth: 280, marginBottom: 28,
          animation: 'scFadeUp 0.6s ease 0.2s both',
        }}>
          南高祭公式サイトは現在非公開設定中です。<br />
          公開まで今しばらくお待ちください。
        </p>

        <button
          onClick={() => router.push('/')}
          style={{
            padding: '12px 28px', borderRadius: 99, border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(12px)',
            boxShadow: 'inset 0 0 0 1.5px rgba(255,107,0,0.4)',
            color: '#FF6B00', fontSize: 13, fontWeight: 700,
            fontFamily: "'Kiwi Maru',serif",
            animation: 'scFadeUp 0.6s ease 0.3s both',
          }}
        >
          ← トップページへ
        </button>
      </div>
    </>
  )
}
