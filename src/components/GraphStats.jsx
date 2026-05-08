import React, { useState, useEffect } from 'react'
import { Database, FileText, Link, RefreshCw, Trash2 } from 'lucide-react'

export default function GraphStats({ refreshTrigger }) {
  const [stats, setStats]  = useState(null)
  const [docs, setDocs]    = useState([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [s, d] = await Promise.all([
        fetch('/api/stats').then(r => r.json()),
        fetch('/api/documents').then(r => r.json()),
      ])
      setStats(s)
      setDocs(d.documents || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [refreshTrigger])

  const deleteDoc = async (id) => {
    await fetch(`/api/documents/${id}`, { method: 'DELETE' })
    load()
  }

  const statCards = [
    { label: 'Documents', value: stats?.docs ?? '—', icon: FileText, color: 'var(--neo-blue)' },
    { label: 'Chunks',    value: stats?.chunks ?? '—', icon: Database, color: 'var(--neo-green)' },
    { label: 'Edges',     value: stats?.edges ?? '—', icon: Link,     color: 'var(--neo-purple)' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} style={{
            background: 'var(--bg-card)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', padding: '10px 8px', textAlign: 'center',
          }}>
            <Icon size={16} color={color} style={{ margin: '0 auto 4px', display: 'block' }} />
            <div style={{ fontSize: 18, fontWeight: 700, color, fontFamily: 'var(--font-mono)' }}>
              {loading ? '…' : value}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>
              {label}
            </div>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <button onClick={load} style={{
        display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center',
        background: 'transparent', border: '1px solid var(--border-bright)',
        borderRadius: 8, padding: '6px 12px', color: 'var(--text-secondary)',
        cursor: 'pointer', fontSize: 12, width: '100%', transition: 'all 0.2s',
      }}
        onMouseOver={e => e.currentTarget.style.borderColor = 'var(--neo-teal)'}
        onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-bright)'}
      >
        <RefreshCw size={12} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
        Refresh graph
      </button>

      {/* Document list */}
      {docs.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 8, fontFamily: 'var(--font-mono)' }}>
            Indexed Documents
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
            {docs.map(doc => (
              <div key={doc.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--bg-input)', borderRadius: 8, padding: '8px 10px',
                border: '1px solid var(--border)',
              }}>
                <FileText size={12} color="var(--neo-teal)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {doc.filename}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                    {doc.chunk_count} chunks
                  </div>
                </div>
                <button onClick={() => deleteDoc(doc.id)} style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', padding: 2, flexShrink: 0,
                  borderRadius: 4, transition: 'color 0.2s',
                }}
                  onMouseOver={e => e.currentTarget.style.color = 'var(--neo-red)'}
                  onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
