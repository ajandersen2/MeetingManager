import { useState } from 'react'
import RichTextEditor from './RichTextEditor'
import { Printer, Maximize2 } from 'lucide-react'

export default function AgendaTab({ content, onChange, meetingName, meetingDate }) {
    const [mode, setMode] = useState('edit') // 'edit' | 'preview'

    const formatDate = (dateStr) => {
        if (!dateStr) return ''
        const date = new Date(dateStr + 'T00:00:00')
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const handlePrint = () => {
        const printContent = `
      <html>
        <head>
          <title>${meetingName} - Agenda</title>
          <style>
            body { font-family: 'Inter', sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
            h1 { text-align: center; border-bottom: 2px solid #0f766e; padding-bottom: 16px; }
            .date { text-align: center; color: #666; margin-bottom: 24px; }
            .subtitle { text-align: center; font-weight: 600; margin-bottom: 24px; }
          </style>
        </head>
        <body>
          <h1>${meetingName || 'Meeting Agenda'}</h1>
          <p class="date">${formatDate(meetingDate)}</p>
          <p class="subtitle">Board Meeting Agenda</p>
          <hr />
          ${content}
        </body>
      </html>
    `
        const printWindow = window.open('', '_blank')
        printWindow.document.write(printContent)
        printWindow.document.close()
        printWindow.print()
    }

    const handleFullscreen = () => {
        const modal = document.querySelector('.modal')
        if (modal.requestFullscreen) {
            modal.requestFullscreen()
        }
    }

    return (
        <div>
            <div className="editor-header">
                <span className="editor-header-label">Meeting Agenda</span>
                <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                    <button
                        className="btn btn-secondary"
                        onClick={handlePrint}
                        style={{ padding: 'var(--spacing-2) var(--spacing-3)' }}
                    >
                        <Printer size={14} />
                        Print
                    </button>
                    <div className="editor-mode-toggle">
                        <button
                            type="button"
                            className={`editor-mode-btn ${mode === 'edit' ? 'active' : ''}`}
                            onClick={() => setMode('edit')}
                        >
                            Edit
                        </button>
                        <button
                            type="button"
                            className={`editor-mode-btn ${mode === 'preview' ? 'active' : ''}`}
                            onClick={() => setMode('preview')}
                        >
                            Preview
                        </button>
                    </div>
                    <button
                        className="btn btn-ghost btn-icon"
                        onClick={handleFullscreen}
                        title="Fullscreen"
                    >
                        <Maximize2 size={16} />
                    </button>
                </div>
            </div>

            {mode === 'edit' ? (
                <RichTextEditor
                    content={content}
                    onChange={onChange}
                    placeholder="Enter meeting agenda..."
                />
            ) : (
                <div className="editor-preview">
                    <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                        <h1 style={{ borderBottom: '2px solid var(--color-primary)', paddingBottom: '16px' }}>
                            {meetingName || 'Meeting Agenda'}
                        </h1>
                        <p style={{ color: 'var(--color-gray-500)', marginBottom: '8px' }}>{formatDate(meetingDate)}</p>
                        <p style={{ fontWeight: 600 }}>Board Meeting Agenda</p>
                    </div>
                    <hr style={{ marginBottom: '24px' }} />
                    <div dangerouslySetInnerHTML={{ __html: content || '<p style="color: var(--color-gray-400)">No agenda content yet.</p>' }} />
                </div>
            )}
        </div>
    )
}
