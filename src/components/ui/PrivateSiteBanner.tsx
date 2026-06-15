const ROLE_LABEL: Record<string, string> = {
  admin:   '管理者',
  editor:  '編集者',
  teacher: '教員',
}

export default function PrivateSiteBanner({ role }: { role: string }) {
  const label = ROLE_LABEL[role] ?? role
  return (
    <div style={{
      background: 'linear-gradient(90deg,#FF4500,#FF8C00)',
      color: '#fff',
      padding: '8px 16px',
      fontSize: 12,
      fontFamily: "'Kiwi Maru',serif",
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexShrink: 0,
    }}>
      <span style={{ fontSize: 14 }}>🔒</span>
      <span>
        現在サイトは<strong>非公開</strong>設定中です。
        あなたは <strong>{label}権限</strong> があるため閲覧できています。
      </span>
    </div>
  )
}
