import React from 'react'
import { User, Search, Database } from 'lucide-react'

const MCL = '#FF8000'

/* Top-view bee SVG — solid orange fill for bot avatar */
const BeeAvatar = () => (
  <svg viewBox="0 0 60 60" width="18" height="18" fill="none"
    stroke={MCL} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
    <ellipse cx="14" cy="28" rx="13" ry="8" transform="rotate(-15 14 28)"
      fill="rgba(255,128,0,0.25)" strokeWidth="1.4"/>
    <ellipse cx="46" cy="28" rx="13" ry="8" transform="rotate(15 46 28)"
      fill="rgba(255,128,0,0.25)" strokeWidth="1.4"/>
    <ellipse cx="16" cy="36" rx="7" ry="4" transform="rotate(-20 16 36)"
      fill="rgba(255,128,0,0.15)" strokeWidth="1.1"/>
    <ellipse cx="44" cy="36" rx="7" ry="4" transform="rotate(20 44 36)"
      fill="rgba(255,128,0,0.15)" strokeWidth="1.1"/>
    <ellipse cx="30" cy="33" rx="8" ry="14" fill="rgba(255,128,0,0.2)" strokeWidth="1.8"/>
    <circle cx="30" cy="16" r="5.5" fill="rgba(255,128,0,0.2)" strokeWidth="1.6"/>
    <circle cx="27.5" cy="15" r="1.2" fill={MCL}/>
    <circle cx="32.5" cy="15" r="1.2" fill={MCL}/>
    <path d="M28 11 C26 7,22 5,20 3" strokeWidth="1.3"/>
    <circle cx="19.5" cy="2.5" r="1.3" fill={MCL}/>
    <path d="M32 11 C34 7,38 5,40 3" strokeWidth="1.3"/>
    <circle cx="40.5" cy="2.5" r="1.3" fill={MCL}/>
    <line x1="22.5" y1="27" x2="37.5" y2="27" strokeWidth="1.3"/>
    <line x1="22.2" y1="33" x2="37.8" y2="33" strokeWidth="1.3"/>
    <line x1="23"   y1="39" x2="37"   y2="39" strokeWidth="1.3"/>
    <line x1="22" y1="26" x2="14" y2="22" strokeWidth="1.1"/>
    <line x1="22" y1="32" x2="13" y2="31" strokeWidth="1.1"/>
    <line x1="22" y1="38" x2="14" y2="42" strokeWidth="1.1"/>
    <line x1="38" y1="26" x2="46" y2="22" strokeWidth="1.1"/>
    <line x1="38" y1="32" x2="47" y2="31" strokeWidth="1.1"/>
    <line x1="38" y1="38" x2="46" y2="42" strokeWidth="1.1"/>
    <path d="M30 47 L28 53 L30 51 L32 53 Z" strokeWidth="1.3"/>
  </svg>
)

/* White person silhouette for user avatar */
const PersonAvatar = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="white"
    xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="7" r="4"/>
    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
  </svg>
)

export default function MessageBubble({ message }) {
  const { role, content, thinking, toolCalls, sources, isStreaming } = message
  const isUser = role === 'user'

  return (
    <div className="fade-in" style={{
      display: 'flex',
      flexDirection: isUser ? 'row-reverse' : 'row',
      gap: 10,
      alignItems: 'flex-start',
      marginBottom: 2,
    }}>
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 10, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'rgba(255,255,255,0.08)'
          : 'rgba(255,128,0,0.1)',
        border: `1px solid ${isUser ? 'rgba(255,255,255,0.15)' : 'rgba(255,128,0,0.25)'}`,
      }}>
        {isUser ? <PersonAvatar /> : <BeeAvatar />}
      </div>

      <div style={{ maxWidth: '85%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Thinking */}
        {thinking && (
          <div style={{
            background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
            borderRadius: 8, padding: '6px 10px', fontSize: 12,
            color: '#a78bfa', fontStyle: 'italic',
          }}>
            💭 {thinking}
          </div>
        )}

        {/* Tool calls */}
        {toolCalls?.map((tc, i) => (
          <div key={i} style={{
            background: 'rgba(255,128,0,0.07)', border: '1px solid rgba(255,128,0,0.2)',
            borderRadius: 8, padding: '6px 10px', fontSize: 11,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <Search size={11} color={MCL} />
            <span style={{ color: MCL, fontFamily: 'monospace' }}>{tc.tool}</span>
            <span style={{ color: '#666' }}>
              "{tc.args?.query?.slice(0, 50)}{tc.args?.query?.length > 50 ? '…' : ''}"
            </span>
            {tc.result && (
              <span style={{ color: '#22c55e', marginLeft: 'auto' }}>✓ {tc.result}</span>
            )}
          </div>
        ))}

        {/* Message bubble */}
        {content && (
          <div style={{
            background: isUser ? 'rgba(255,255,255,0.06)' : '#212121',
            border: `1px solid ${isUser ? 'rgba(255,255,255,0.1)' : '#2a2a2a'}`,
            borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
            padding: '10px 14px',
            color: '#e8e8e8',
            fontSize: 14,
            lineHeight: 1.7,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}>
            {content}
            {isStreaming && (
              <span style={{
                display: 'inline-block', width: 7, height: 14,
                background: MCL, marginLeft: 2, verticalAlign: 'middle',
                animation: 'blink 1s step-end infinite', borderRadius: 1,
              }} />
            )}
          </div>
        )}

        {/* Sources */}
        {sources?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, paddingLeft: 2 }}>
            {sources.slice(0, 4).map((s, i) => (
              <span key={i} style={{
                display: 'flex', alignItems: 'center', gap: 4,
                background: 'rgba(255,128,0,0.07)', border: '1px solid rgba(255,128,0,0.2)',
                borderRadius: 6, padding: '2px 7px', fontSize: 10, color: MCL,
              }}>
                <Database size={8} />
                {s.doc_id?.slice(0, 8)}…
              </span>
            ))}
            {sources.length > 4 && (
              <span style={{ fontSize: 10, color: '#555', padding: '2px 4px' }}>
                +{sources.length - 4} more
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export function TypingIndicator() {
  return (
    <div className="fade-in" style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      <div style={{
        width: 32, height: 32, borderRadius: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(255,128,0,0.1)', border: '1px solid rgba(255,128,0,0.25)',
      }}>
        <BeeAvatar />
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: MCL,
            animation: `pulse 1.2s ease infinite ${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}
