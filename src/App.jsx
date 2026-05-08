import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Home, Inbox, Upload, GitBranch, FileText, Trash2, RefreshCw,
         ChevronRight, Plus, HelpCircle, MessageSquare, Settings, Send } from 'lucide-react'
import FileUpload from './components/FileUpload'
import MessageBubble, { TypingIndicator } from './components/MessageBubble'

const MCL = '#FF8000'
const MCL_DIM = 'rgba(255,128,0,0.15)'

/*  Top-view bee — solid white filled */
const BeeTopView = ({ size=28 }) => (
  <svg viewBox="0 0 60 60" width={size} height={size} fill="none"
    stroke="white" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.6">
    {/* Wings — semi-transparent white fill */}
    <ellipse cx="14" cy="28" rx="13" ry="8" transform="rotate(-15 14 28)"
      fill="rgba(255,255,255,0.3)" strokeWidth="1.4"/>
    <ellipse cx="46" cy="28" rx="13" ry="8" transform="rotate(15 46 28)"
      fill="rgba(255,255,255,0.3)" strokeWidth="1.4"/>
    <ellipse cx="16" cy="36" rx="7" ry="4" transform="rotate(-20 16 36)"
      fill="rgba(255,255,255,0.2)" strokeWidth="1.1"/>
    <ellipse cx="44" cy="36" rx="7" ry="4" transform="rotate(20 44 36)"
      fill="rgba(255,255,255,0.2)" strokeWidth="1.1"/>
    {/* Body — solid white */}
    <ellipse cx="30" cy="33" rx="8" ry="14" fill="white" strokeWidth="1.8"/>
    {/* Head — solid white */}
    <circle cx="30" cy="16" r="5.5" fill="white" strokeWidth="1.6"/>
    {/* Eyes — dark */}
    <circle cx="27.5" cy="15" r="1.2" fill="#191919"/>
    <circle cx="32.5" cy="15" r="1.2" fill="#191919"/>
    {/* Antennae */}
    <path d="M28 11 C26 7,22 5,20 3" strokeWidth="1.3"/>
    <circle cx="19.5" cy="2.5" r="1.3" fill="white"/>
    <path d="M32 11 C34 7,38 5,40 3" strokeWidth="1.3"/>
    <circle cx="40.5" cy="2.5" r="1.3" fill="white"/>
    {/* Stripes — dark on white body */}
    <line x1="22.5" y1="27" x2="37.5" y2="27" stroke="#191919" strokeWidth="1.3"/>
    <line x1="22.2" y1="33" x2="37.8" y2="33" stroke="#191919" strokeWidth="1.3"/>
    <line x1="23"   y1="39" x2="37"   y2="39" stroke="#191919" strokeWidth="1.3"/>
    {/* Legs */}
    <line x1="22" y1="26" x2="14" y2="22" strokeWidth="1.1"/>
    <line x1="22" y1="32" x2="13" y2="31" strokeWidth="1.1"/>
    <line x1="22" y1="38" x2="14" y2="42" strokeWidth="1.1"/>
    <line x1="38" y1="26" x2="46" y2="22" strokeWidth="1.1"/>
    <line x1="38" y1="32" x2="47" y2="31" strokeWidth="1.1"/>
    <line x1="38" y1="38" x2="46" y2="42" strokeWidth="1.1"/>
    {/* Stinger */}
    <path d="M30 47 L28 53 L30 51 L32 53 Z" fill="white" strokeWidth="1.3"/>
  </svg>
)

const SUGGESTIONS = [
  'Summarize the main findings',
  'What methods are described?',
  'Compare key concepts',
  'What are the conclusions?',
  'Explain the methodology',
]

/* Colors */
const bg    = '#191919'
const bg2   = '#212121'
const bg3   = '#2a2a2a'
const txt   = '#e8e8e8'
const txt2  = '#888'
const bdr   = '#333'

export default function App() {
  const [messages, setMessages]           = useState([])
  const [input, setInput]                 = useState('')
  const [isThinking, setIsThinking]       = useState(false)
  const [ingestTrigger, setIngestTrigger] = useState(0)
  const [docs, setDocs]                   = useState([])
  const [stats, setStats]                 = useState(null)
  const [activeNav, setActiveNav]         = useState('chat')
  const [activeDoc, setActiveDoc]         = useState(null)
  const [health, setHealth]               = useState(null)
  const [showUpload, setShowUpload]       = useState(false)
  const messagesEndRef                    = useRef(null)
  const textareaRef                       = useRef(null)

  const loadData = async () => {
    try {
      const [s,d] = await Promise.all([
        fetch('/api/stats').then(r=>r.json()),
        fetch('/api/documents').then(r=>r.json()),
      ])
      setStats(s); setDocs(d.documents||[])
    } catch {}
  }

  useEffect(() => {
    fetch('/api/health').then(r=>r.json()).then(setHealth).catch(()=>{})
    loadData()
  }, [ingestTrigger])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [messages,isThinking])

  const sendMessage = useCallback(async (query) => {
    if (!query.trim()||isThinking) return
    setShowUpload(false)
    const uid=Date.now(), aid=uid+1
    setMessages(prev=>[...prev,{id:uid,role:'user',content:query},{id:aid,role:'assistant',content:'',isStreaming:true}])
    setInput(''); setIsThinking(true)
    const history=messages.slice(-10).map(m=>({role:m.role,content:m.content}))
    try {
      const resp=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,conversation_history:history})})
      const reader=resp.body.getReader(), dec=new TextDecoder(); let buf=''
      while(true){
        const {done,value}=await reader.read(); if(done) break
        buf+=dec.decode(value,{stream:true})
        const lines=buf.split('\n'); buf=lines.pop()
        for(const line of lines){
          if(!line.startsWith('data: ')) continue
          const data=JSON.parse(line.slice(6))
          setMessages(prev=>prev.map(m=>{
            if(m.id!==aid) return m
            if(data.type==='tool_call')   return {...m,toolCalls:[...(m.toolCalls||[]),{tool:data.tool,args:data.args}]}
            if(data.type==='tool_result'){const t=[...(m.toolCalls||[])];if(t.length)t[t.length-1].result=data.content;return{...m,toolCalls:t}}
            if(data.type==='token')  return {...m,content:(m.content||'')+data.content}
            if(data.type==='done')   return {...m,isStreaming:false,sources:data.sources}
            if(data.type==='error')  return {...m,content:'Error: '+data.content,isStreaming:false}
            return m
          }))
        }
      }
    } catch(e){setMessages(prev=>prev.map(m=>m.id===aid?{...m,content:'Error: '+e.message,isStreaming:false}:m))}
    setIsThinking(false)
  }, [messages,isThinking])

  const onKeyDown = e => { if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendMessage(input)} }
  const deleteDoc = async id => { await fetch(`/api/documents/${id}`,{method:'DELETE'}); loadData() }

  /* nav items replacing Search/Home/Inbox */
  const topNav = [
    { id:'search', icon:Search,    label:'Search',        shortcut:'⌃K' },
    { id:'upload', icon:Upload,    label:'Upload',        shortcut:null },
    { id:'graph',  icon:GitBranch, label:'Graph',         shortcut:null },
  ]

  const navRow = (id,Icon,label,shortcut,active,onClick) => (
    <div key={id} onClick={onClick} style={{
      display:'flex',alignItems:'center',justifyContent:'space-between',
      padding:'5px 10px',borderRadius:6,cursor:'pointer',
      background: active ? bg3 : 'transparent',
      color: active ? txt : txt2,
      transition:'background 0.12s,color 0.12s',
      marginBottom:1,
    }}
      onMouseOver={e=>{if(!active)e.currentTarget.style.background=bg3}}
      onMouseOut={e=>{if(!active)e.currentTarget.style.background='transparent'}}
    >
      <div style={{display:'flex',alignItems:'center',gap:8,fontSize:13}}>
        <Icon size={14}/>{label}
      </div>
      {shortcut&&<span style={{fontSize:10,color:bg3==='#2a2a2a'?'#555':'#555',background:bg2,border:`1px solid ${bdr}`,borderRadius:4,padding:'1px 5px'}}>{shortcut}</span>}
    </div>
  )

  const breadcrumb = activeDoc ? activeDoc.filename : 'New Chat'

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',fontFamily:'"Inter",system-ui,sans-serif',background:bg,color:txt}}>

      {/* LEFT SIDEBAR */}
      <div style={{width:240,flexShrink:0,display:'flex',flexDirection:'column',background:bg2,borderRight:`1px solid ${bdr}`}}>

        {/* Logo + Name + New button */}
        <div style={{padding:'14px 12px 10px',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div style={{display:'flex',alignItems:'center',gap:9}}>
            <div style={{color:txt,lineHeight:0}}><BeeTopView size={32}/></div>
            <span style={{fontSize:19,fontWeight:700,color:txt,letterSpacing:'-0.4px'}}>Innate Env.</span>
          </div>
          <button onClick={()=>{setShowUpload(true);setActiveNav('upload')}} style={{
            display:'flex',alignItems:'center',gap:4,padding:'4px 10px',
            background:MCL,border:'none',borderRadius:6,cursor:'pointer',
            color:'#fff',fontSize:12,fontWeight:600,
          }}>
            <Plus size={12}/> New
          </button>
        </div>

        <div style={{height:1,background:bdr,margin:'4px 0 0'}}/>

        {/* Big Upload button */}
        <div style={{padding:'10px 12px 6px'}}>
          <button onClick={()=>{setShowUpload(s=>!s);setActiveNav('upload')}} style={{
            display:'flex',alignItems:'center',gap:9,width:'100%',
            padding:'12px 16px',
            background: showUpload ? MCL_DIM : bg3,
            border:`1px solid ${showUpload ? MCL : bdr}`,
            borderRadius:8,cursor:'pointer',
            color: showUpload ? MCL : txt,
            fontSize:14,fontWeight:500,transition:'all 0.15s',
          }}
            onMouseOver={e=>{e.currentTarget.style.borderColor=MCL;e.currentTarget.style.color=MCL;e.currentTarget.style.background=MCL_DIM}}
            onMouseOut={e=>{if(!showUpload){e.currentTarget.style.borderColor=bdr;e.currentTarget.style.color=txt;e.currentTarget.style.background=bg3}}}
          >
            <Upload size={16}/> Upload Document
          </button>
        </div>

        {/* Your Graph — like "Your Journals" */}
        <div style={{padding:'6px 12px 4px'}}>
          <div style={{fontSize:13,fontWeight:600,color:txt2,textTransform:'uppercase',letterSpacing:1.2,marginBottom:8}}>
            Your Graph
          </div>
          {stats ? (
            [['Docs',stats.docs??0,'📄'],['Nodes',stats.chunks??0,'◈'],['Edges',stats.edges??0,'⟶']].map(([l,v,ic])=>(
              <div key={l} style={{display:'flex',alignItems:'center',justifyContent:'space-between',
                padding:'4px 8px',borderRadius:5,marginBottom:2,cursor:'default',color:txt2,fontSize:13}}>
                <span>{ic} {l}</span>
                <span style={{color:txt,fontWeight:500}}>{v}</span>
              </div>
            ))
          ) : (
            <div style={{fontSize:12,color:txt2,padding:'2px 8px'}}>Loading…</div>
          )}
          <button onClick={loadData} style={{
            display:'flex',alignItems:'center',gap:5,fontSize:11,color:txt2,
            background:'transparent',border:'none',cursor:'pointer',padding:'4px 8px',marginTop:2,
          }}>
            <RefreshCw size={10}/> Refresh
          </button>
        </div>

        <div style={{height:1,background:bdr,margin:'6px 0'}}/>

        {/* Your Documents — like "Your Papers" */}
        <div style={{padding:'6px 12px 4px',flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{fontSize:13,fontWeight:600,color:txt2,textTransform:'uppercase',letterSpacing:1.2,marginBottom:8}}>
            Your Documents
          </div>
          <div style={{flex:1,overflowY:'auto'}}>
            {docs.length===0
              ? <div style={{fontSize:12,color:txt2,padding:'2px 8px'}}>No documents yet</div>
              : docs.map(doc=>(
                <div key={doc.id} onClick={()=>{setActiveDoc(doc);setActiveNav('doc')}}
                  style={{
                    display:'flex',alignItems:'center',gap:7,padding:'5px 8px',
                    borderRadius:5,cursor:'pointer',marginBottom:2,
                    background: activeDoc?.id===doc.id ? bg3 : 'transparent',
                    transition:'background 0.12s',
                  }}
                  onMouseOver={e=>{if(activeDoc?.id!==doc.id)e.currentTarget.style.background=bg3}}
                  onMouseOut={e=>{if(activeDoc?.id!==doc.id)e.currentTarget.style.background='transparent'}}
                >
                  <FileText size={12} style={{flexShrink:0,color:txt2}}/>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{fontSize:12,color:txt,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{doc.filename}</div>
                    <div style={{fontSize:10,color:txt2}}>{doc.chunk_count} chunks</div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();deleteDoc(doc.id)}}
                    style={{background:'transparent',border:'none',cursor:'pointer',color:'#555',padding:2,flexShrink:0}}
                    onMouseOver={e=>e.currentTarget.style.color='#ef4444'}
                    onMouseOut={e=>e.currentTarget.style.color='#555'}>
                    <Trash2 size={10}/>
                  </button>
                </div>
              ))
            }
          </div>
        </div>

        {/* Bottom — Neo4j, Ollama (replacing Upgrade/Feedback/Help/User) */}
        <div style={{borderTop:`1px solid ${bdr}`,padding:'10px 12px'}}>
          {/* Neo4j row */}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:5,marginBottom:2,cursor:'default'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#4a9eff" strokeWidth="1.8"/>
              <circle cx="12" cy="12" r="3"  fill="#4a9eff"/>
              <line x1="12" y1="2"  x2="12" y2="9"  stroke="#4a9eff" strokeWidth="1.5"/>
              <line x1="12" y1="15" x2="12" y2="22" stroke="#4a9eff" strokeWidth="1.5"/>
              <line x1="2"  y1="12" x2="9"  y2="12" stroke="#4a9eff" strokeWidth="1.5"/>
              <line x1="15" y1="12" x2="22" y2="12" stroke="#4a9eff" strokeWidth="1.5"/>
            </svg>
            <span style={{fontSize:12,color:txt2}}>Neo4j Aura</span>
            <span style={{marginLeft:'auto',width:7,height:7,borderRadius:'50%',
              background:health?.neo4j==='ok'?MCL:'#666',flexShrink:0,display:'inline-block'}}/>
          </div>
          {/* Ollama row */}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:5,marginBottom:2,cursor:'default'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 12h8M8 8h8M8 16h4"/>
            </svg>
            <span style={{fontSize:12,color:txt2}}>Ollama · llama3.1</span>
          </div>
          {/* nomic row */}
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'5px 8px',borderRadius:5,cursor:'default'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="1.8">
              <polyline points="2,18 8,8 12,14 16,6 22,18"/>
            </svg>
            <span style={{fontSize:12,color:txt2}}>nomic-embed-text</span>
          </div>
        </div>
      </div>

      {/*  MAIN AREA*/}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',background:bg}}>

        {/* Top bar — breadcrumb + centered search bar */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'10px 20px',borderBottom:`1px solid ${bdr}`,background:bg2}}>
          {/* Breadcrumb */}
          <div style={{display:'flex',alignItems:'center',gap:6,fontSize:13,color:txt2,flexShrink:0}}>
            <div style={{width:20,height:20,borderRadius:4,background:bg3,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <MessageSquare size={11} color={txt2}/>
            </div>
            <span style={{color:txt2}}>/</span>
            <span style={{color:txt,fontWeight:500}}>{breadcrumb}</span>
          </div>

          {/* Center search / query box */}
          <div style={{flex:1,display:'flex',justifyContent:'center'}}>
            <div style={{
              display:'flex',alignItems:'center',gap:8,width:'100%',maxWidth:560,
              background:bg3,border:`1px solid ${bdr}`,borderRadius:8,
              padding:'7px 12px',transition:'border-color 0.15s',
            }}
              onFocus={()=>{}} onMouseOver={e=>e.currentTarget.style.borderColor=MCL}
              onMouseOut={e=>e.currentTarget.style.borderColor=bdr}
            >
              {/* Bee logo inside query box */}
              <div style={{flexShrink:0,color:txt2,opacity:0.7,lineHeight:0}}>
                <BeeTopView size={18}/>
              </div>
              <textarea ref={textareaRef} value={input} onChange={e=>setInput(e.target.value)}
                onKeyDown={onKeyDown} placeholder="Ask to look something..." rows={1}
                disabled={isThinking}
                style={{
                  flex:1,background:'transparent',border:'none',outline:'none',
                  color:txt,fontSize:13,resize:'none',fontFamily:'inherit',
                  lineHeight:1.5,maxHeight:80,overflowY:'auto',caretColor:MCL,
                }}
                onInput={e=>{e.target.style.height='auto';e.target.style.height=Math.min(e.target.scrollHeight,80)+'px'}}
              />
              {isThinking
                ? <span style={{fontSize:11,color:txt2,flexShrink:0}}>Thinking…</span>
                : <button onClick={()=>sendMessage(input)} disabled={!input.trim()} style={{
                    width:26,height:26,borderRadius:'50%',border:'none',flexShrink:0,
                    background:input.trim()?MCL:bg,cursor:input.trim()?'pointer':'default',
                    display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.15s',
                  }}>
                    <Send size={11} color={input.trim()?'#fff':txt2}/>
                  </button>
              }
            </div>
          </div>

          {/* Right side icons */}
          <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
            <Settings size={15} color={txt2} style={{cursor:'pointer'}}/>
            <HelpCircle size={15} color={txt2} style={{cursor:'pointer'}}/>
          </div>
        </div>

        {/* Upload panel (shown when upload selected) */}
        {showUpload && (
          <div style={{padding:'20px 32px',borderBottom:`1px solid ${bdr}`,background:bg2}}>
            <div style={{maxWidth:560,margin:'0 auto'}}>
              <div style={{fontSize:14,fontWeight:500,color:txt,marginBottom:10}}>Upload document</div>
              <FileUpload onIngested={()=>{setIngestTrigger(t=>t+1);setShowUpload(false);setActiveNav('graph')}}/>
            </div>
          </div>
        )}

        {/* Messages / empty state */}
        <div style={{flex:1,overflowY:'auto',padding:'28px 32px'}}>
          {messages.length===0
            ? <EmptyState onQuery={q=>sendMessage(q)}/>
            : (
              <div style={{display:'flex',flexDirection:'column',gap:18,maxWidth:700,margin:'0 auto'}}>
                {messages.map(msg=><MessageBubble key={msg.id} message={msg}/>)}
                {isThinking&&messages[messages.length-1]?.role!=='assistant'&&<TypingIndicator/>}
                <div ref={messagesEndRef}/>
              </div>
            )
          }
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onQuery }) {
  return (
    <div style={{maxWidth:620,margin:'24px auto 0',display:'flex',flexDirection:'column',gap:32}}>
      <div>
        <div style={{fontSize:28,fontWeight:700,color:txt,marginBottom:8,letterSpacing:'-0.5px'}}>
          Knowledge Graph Chat
        </div>
        <div style={{fontSize:14,color:txt2,lineHeight:1.8}}>
          Upload documents using the left panel, then ask questions.<br/>
          Uses vector search and graph traversal for context-aware answers.
        </div>
      </div>

      {/* Pipeline */}
      <div style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
        {['Upload','Parse','Vision','Chunk','Embed','Neo4j'].map((s,i,arr)=>(
          <React.Fragment key={s}>
            <span style={{fontSize:12,padding:'3px 10px',borderRadius:20,
              border:`1px solid ${bdr}`,color:txt2,background:bg2}}>{s}</span>
            {i<arr.length-1&&<ChevronRight size={11} color={bdr}/>}
          </React.Fragment>
        ))}
      </div>

      {/* Suggestion chips — highlighted white style like reference */}
      <div>
        <div style={{fontSize:12,color:txt2,marginBottom:10}}>Quick actions</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
          {[...SUGGESTIONS,'More'].map((q,i)=>(
            <div key={q} onClick={()=>q!=='More'&&onQuery(q)} style={{
              padding:'9px 16px',
              border:`1px solid ${i===SUGGESTIONS.length?'#444':bdr}`,
              borderRadius:8,cursor:q==='More'?'default':'pointer',
              fontSize:13,color:i===SUGGESTIONS.length?txt2:txt,
              background:bg2,transition:'all 0.15s',
            }}
              onMouseOver={e=>{if(q!=='More'){e.currentTarget.style.borderColor=MCL;e.currentTarget.style.color=MCL}}}
              onMouseOut={e=>{e.currentTarget.style.borderColor=i===SUGGESTIONS.length?'#444':bdr;e.currentTarget.style.color=i===SUGGESTIONS.length?txt2:txt}}
            >{q}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
