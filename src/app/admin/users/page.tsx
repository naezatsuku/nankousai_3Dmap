'use client'

import { useState } from 'react'

interface User { id:string; name:string; email:string; role:'admin'|'editor'; class_label:string; exhibits:string[] }

const INIT_USERS:User[] = [
  { id:'u1', name:'田中 颯',   email:'tanaka@example.com', role:'editor', class_label:'高2-1', exhibits:['高2-1 お化け屋敷'] },
  { id:'u2', name:'鈴木 葵',   email:'suzuki@example.com', role:'editor', class_label:'高2-2', exhibits:['高2-2 カフェ'] },
  { id:'u3', name:'高橋 凛',   email:'takahashi@example.com', role:'editor', class_label:'高2-3', exhibits:['高2-3 縁日'] },
  { id:'u4', name:'管理者A',   email:'admin@example.com', role:'admin',  class_label:'—', exhibits:[] },
]

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>(INIT_USERS)
  const [newEmail, setNewEmail] = useState('')

  const removeExhibit = (uid:string, ex:string) => {
    setUsers(us => us.map(u => u.id===uid ? {...u, exhibits:u.exhibits.filter(e=>e!==ex)} : u))
  }
  const toggleRole = (uid:string) => {
    setUsers(us => us.map(u => u.id===uid ? {...u, role:u.role==='admin'?'editor':'admin'} : u))
  }

  return (
    <div style={{ maxWidth:800 }}>
      <div style={{ marginBottom:24 }}>
        <h2 style={{ fontFamily:"'Kaisei Decol',serif", fontSize:20, fontWeight:700, color:'#1e293b', marginBottom:4 }}>権限管理</h2>
        <div style={{ fontSize:12, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>編集権限の付与・剥奪を管理します</div>
      </div>

      {/* ユーザー招待 */}
      <div style={{ background:'#fff', borderRadius:16, padding:'18px', marginBottom:20, boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
        <div style={{ fontFamily:"'Kaisei Decol',serif", fontSize:14, fontWeight:700, color:'#1e293b', marginBottom:12 }}>
          ＋ ユーザーを招待
        </div>
        <div style={{ display:'flex', gap:10 }}>
          <input value={newEmail} onChange={e=>setNewEmail(e.target.value)}
            placeholder="メールアドレスを入力"
            style={{ flex:1, padding:'9px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontSize:13, fontFamily:"'Kiwi Maru',serif" }}
          />
          <button style={{ padding:'9px 18px', borderRadius:8, border:'none', background:'linear-gradient(135deg,#FF6B00,#FFAA28)', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer', fontFamily:"'Kiwi Maru',serif", flexShrink:0 }}>
            招待する
          </button>
        </div>
      </div>

      {/* ユーザー一覧 */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {users.map(u => (
          <div key={u.id} style={{ background:'#fff', borderRadius:16, padding:'18px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              {/* アバター */}
              <div style={{
                width:42, height:42, borderRadius:'50%', flexShrink:0,
                background: u.role==='admin' ? 'linear-gradient(135deg,#FF6B00,#FFAA28)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize:16, fontWeight:700, color:'#fff',
              }}>{u.name[0]}</div>

              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:3 }}>
                  <span style={{ fontFamily:"'Kaisei Decol',serif", fontSize:15, fontWeight:700, color:'#1e293b' }}>{u.name}</span>
                  <span style={{
                    fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:99,
                    background: u.role==='admin'?'rgba(255,107,0,0.15)':'rgba(99,102,241,0.12)',
                    color: u.role==='admin'?'#FF6B00':'#6366f1',
                    fontFamily:"'Kiwi Maru',serif",
                  }}>{u.role.toUpperCase()}</span>
                </div>
                <div style={{ fontSize:11, color:'#94a3b8', fontFamily:"'Kiwi Maru',serif" }}>{u.email}</div>

                {/* 担当展示 */}
                {u.role === 'editor' && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ fontSize:10, color:'#94a3b8', marginBottom:6, fontFamily:"'Kiwi Maru',serif" }}>担当展示</div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {u.exhibits.map(ex => (
                        <span key={ex} style={{
                          display:'inline-flex', alignItems:'center', gap:4,
                          background:'#f1f5f9', borderRadius:99, padding:'3px 10px',
                          fontSize:11, color:'#475569', fontFamily:"'Kiwi Maru',serif",
                        }}>
                          {ex}
                          <button onClick={()=>removeExhibit(u.id,ex)} style={{
                            background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:12, padding:0, lineHeight:1,
                          }}>✕</button>
                        </span>
                      ))}
                      <button style={{
                        background:'none', border:'1px dashed #cbd5e1', borderRadius:99,
                        padding:'3px 10px', fontSize:11, color:'#94a3b8', cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                      }}>＋ 追加</button>
                    </div>
                  </div>
                )}
              </div>

              {/* アクション */}
              <div style={{ display:'flex', flexDirection:'column', gap:6, flexShrink:0 }}>
                <button onClick={()=>toggleRole(u.id)} style={{
                  padding:'6px 12px', borderRadius:8, border:'1px solid #e2e8f0',
                  background:'#fff', fontSize:11, color:'#64748b', cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                }}>
                  {u.role==='admin' ? 'editorに変更' : 'adminに昇格'}
                </button>
                <button style={{
                  padding:'6px 12px', borderRadius:8, border:'1px solid #fee2e2',
                  background:'#fff', fontSize:11, color:'#ef4444', cursor:'pointer', fontFamily:"'Kiwi Maru',serif",
                }}>
                  削除
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}