import React, { useState, useRef, useCallback } from 'react'
import { Upload, FileText, CheckCircle, AlertCircle, Loader, X } from 'lucide-react'

const ACCEPTED = '.pdf,.docx,.txt,.csv,.json,.md'

export default function FileUpload({ onIngested }) {
  const [dragging, setDragging] = useState(false)
  const [files, setFiles]       = useState([]) // {name, status, stages, error}
  const inputRef = useRef()

  const handleFiles = useCallback((fileList) => {
    Array.from(fileList).forEach(file => ingestFile(file))
  }, [])

  async function ingestFile(file) {
    const entry = { id: Date.now() + Math.random(), name: file.name, status: 'uploading', stages: [] }
    setFiles(prev => [entry, ...prev])

    const formData = new FormData()
    formData.append('file', file)

    try {
      const resp = await fetch('/api/ingest', { method: 'POST', body: formData })
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = JSON.parse(line.slice(6))
          if (data.type === 'done') {
            setFiles(prev => prev.map(f => f.id === entry.id
              ? { ...f, status: 'done', result: data }
              : f
            ))
            onIngested?.()
          } else if (data.type === 'error') {
            setFiles(prev => prev.map(f => f.id === entry.id
              ? { ...f, status: 'error', error: data.message }
              : f
            ))
          } else if (data.type === 'start') {
            setFiles(prev => prev.map(f => f.id === entry.id
              ? { ...f, status: 'processing' }
              : f
            ))
          }
        }
      }
    } catch (e) {
      setFiles(prev => prev.map(f => f.id === entry.id
        ? { ...f, status: 'error', error: e.message }
        : f
      ))
    }
  }

  const onDrop = e => {
    e.preventDefault(); setDragging(false)
    handleFiles(e.dataTransfer.files)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Drop zone */}
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `2px dashed ${dragging ? 'var(--neo-green)' : 'var(--border-bright)'}`,
          borderRadius: 'var(--radius-lg)',
          padding: '28px 20px',
          textAlign: 'center',
          cursor: 'pointer',
          background: dragging ? 'rgba(0,229,160,0.04)' : 'var(--bg-card)',
          transition: 'all 0.2s',
        }}
      >
        <Upload size={28} color={dragging ? 'var(--neo-green)' : 'var(--text-secondary)'}
          style={{ margin: '0 auto 10px', display: 'block' }} />
        <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
          <span style={{ color: 'var(--neo-green)', fontWeight: 600 }}>Click to upload</span>
          {' '}or drag & drop
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
          PDF · DOCX · TXT · CSV · JSON · MD
        </div>
        <input
          ref={inputRef} type="file" multiple accept={ACCEPTED}
          style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)}
        />
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {files.map(f => (
            <FileItem key={f.id} file={f}
              onRemove={() => setFiles(prev => prev.filter(x => x.id !== f.id))} />
          ))}
        </div>
      )}
    </div>
  )
}

function FileItem({ file, onRemove }) {
  const icon = {
    uploading:   <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--neo-teal)' }} />,
    processing:  <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--neo-amber)' }} />,
    done:        <CheckCircle size={14} color="var(--neo-green)" />,
    error:       <AlertCircle size={14} color="var(--neo-red)" />,
  }[file.status]

  const label = {
    uploading:  'Uploading…',
    processing: 'Processing…',
    done:       `✓ ${file.result?.chunks ?? 0} chunks`,
    error:      file.error || 'Error',
  }[file.status]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      background: 'var(--bg-input)', borderRadius: 8,
      padding: '8px 12px', border: '1px solid var(--border)',
    }}>
      <FileText size={14} color="var(--text-secondary)" />
      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {icon}
        <span style={{ fontSize: 11, color: file.status === 'error' ? 'var(--neo-red)' : 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      {(file.status === 'done' || file.status === 'error') && (
        <X size={12} color="var(--text-muted)" style={{ cursor: 'pointer' }} onClick={onRemove} />
      )}
    </div>
  )
}
