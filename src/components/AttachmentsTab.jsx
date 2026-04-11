import { useState, useEffect, useRef } from 'react'
import { api } from '../lib/api'
import { Upload, File, Trash2, Download, FileAudio, Loader2 } from 'lucide-react'

const AUDIO_EXTENSIONS = ['.webm', '.mp3', '.wav', '.m4a', '.ogg', '.flac', '.aac']

function isAudioFile(fileName) {
    const lower = fileName.toLowerCase()
    return AUDIO_EXTENSIONS.some(ext => lower.endsWith(ext))
}

export default function AttachmentsTab({ meetingId, onTranscriptReady }) {
    const [attachments, setAttachments] = useState([])
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [dragOver, setDragOver] = useState(false)
    const [deepgramKey, setDeepgramKey] = useState(null)
    const [transcribingId, setTranscribingId] = useState(null)
    const [transcribeError, setTranscribeError] = useState(null)
    const fileInputRef = useRef(null)

    // Load Deepgram API key
    useEffect(() => {
        const loadKey = async () => {
            try {
                const data = await api.get('/api/api-keys')
                if (data?.deepgram_api_key) {
                    setDeepgramKey(data.deepgram_api_key)
                }
            } catch (err) {
                // No key stored yet
            }
        }
        loadKey()
    }, [])

    const handleTranscribe = async (attachment) => {
        if (!deepgramKey) {
            setTranscribeError('No Deepgram API key found. Add it in Settings > Admin.')
            return
        }
        if (!onTranscriptReady) return

        setTranscribingId(attachment.id)
        setTranscribeError(null)

        try {
            // Download the audio file
            const blob = await api.download(`/api/attachments/${attachment.id}/download`)

            // Send for transcription
            const result = await api.uploadBlob('/api/transcribe', blob, attachment.file_name, 'audio/webm')

            if (result.transcript) {
                onTranscriptReady(result.transcript, result.speakers || 0)
            } else {
                setTranscribeError('No transcript returned. The audio may be too short or unclear.')
            }
        } catch (err) {
            console.error('Transcription error:', err)
            setTranscribeError(err.message || 'Transcription failed. Please try again.')
        } finally {
            setTranscribingId(null)
        }
    }

    useEffect(() => {
        if (meetingId) {
            fetchAttachments()
        } else {
            setLoading(false)
        }
    }, [meetingId])

    const fetchAttachments = async () => {
        try {
            const data = await api.get(`/api/meetings/${meetingId}/attachments`)
            setAttachments(data || [])
        } catch (error) {
            console.error('Error fetching attachments:', error)
        } finally {
            setLoading(false)
        }
    }

    const formatFileSize = (bytes) => {
        if (bytes < 1024) return bytes + ' B'
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
    }

    const handleUpload = async (files) => {
        if (!meetingId) {
            alert('Please save the meeting first before uploading attachments.')
            return
        }

        setUploading(true)

        for (const file of files) {
            try {
                await api.upload(`/api/meetings/${meetingId}/attachments`, file)
            } catch (error) {
                console.error('Error uploading file:', error)
                alert(`Failed to upload ${file.name}`)
            }
        }

        await fetchAttachments()
        setUploading(false)
    }

    const handleDelete = async (attachment) => {
        if (!confirm(`Delete ${attachment.file_name}?`)) return

        try {
            await api.delete(`/api/attachments/${attachment.id}`)
            await fetchAttachments()
        } catch (error) {
            console.error('Error deleting attachment:', error)
            alert('Failed to delete attachment')
        }
    }

    const handleDownload = async (attachment) => {
        try {
            const blob = await api.download(`/api/attachments/${attachment.id}/download`)
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = attachment.file_name
            a.click()
            URL.revokeObjectURL(url)
        } catch (error) {
            console.error('Error downloading file:', error)
            alert('Failed to download file')
        }
    }

    const handleDragOver = (e) => {
        e.preventDefault()
        setDragOver(true)
    }

    const handleDragLeave = (e) => {
        e.preventDefault()
        setDragOver(false)
    }

    const handleDrop = (e) => {
        e.preventDefault()
        setDragOver(false)
        const files = Array.from(e.dataTransfer.files)
        if (files.length > 0) {
            handleUpload(files)
        }
    }

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files)
        if (files.length > 0) {
            handleUpload(files)
        }
        e.target.value = ''
    }

    if (loading) {
        return (
            <div className="loading-screen" style={{ minHeight: '200px' }}>
                <div className="loading-spinner"></div>
            </div>
        )
    }

    return (
        <div>
            <button
                className="btn btn-secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || !meetingId}
            >
                <Upload size={16} />
                {uploading ? 'Uploading...' : 'Upload File'}
            </button>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                onChange={handleFileSelect}
            />

            <div
                className={`file-upload-area ${dragOver ? 'dragover' : ''}`}
                style={{ marginTop: 'var(--spacing-4)' }}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
            >
                <Upload size={32} className="file-upload-icon" />
                <p className="file-upload-text">
                    {!meetingId
                        ? 'Save the meeting first to enable attachments'
                        : 'Drag and drop files here, or click to select'
                    }
                </p>
            </div>

            {attachments.length > 0 ? (
                <div className="attachment-list">
                    {attachments.map(attachment => (
                        <div key={attachment.id} className="attachment-item">
                            <div className="attachment-info">
                                {isAudioFile(attachment.file_name) ? (
                                    <FileAudio size={20} style={{ color: 'var(--color-primary)' }} />
                                ) : (
                                    <File size={20} style={{ color: 'var(--color-gray-400)' }} />
                                )}
                                <div>
                                    <div className="attachment-name">{attachment.file_name}</div>
                                    <div className="attachment-size">{formatFileSize(attachment.file_size)}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                {isAudioFile(attachment.file_name) && onTranscriptReady && deepgramKey && (
                                    <button
                                        className="btn btn-ghost btn-icon"
                                        onClick={() => handleTranscribe(attachment)}
                                        disabled={transcribingId !== null}
                                        title="Transcribe audio"
                                        style={{ color: 'var(--color-primary)' }}
                                    >
                                        {transcribingId === attachment.id ? (
                                            <Loader2 size={16} className="spinning" />
                                        ) : (
                                            <FileAudio size={16} />
                                        )}
                                    </button>
                                )}
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => handleDownload(attachment)}
                                    title="Download"
                                >
                                    <Download size={16} />
                                </button>
                                <button
                                    className="btn btn-ghost btn-icon"
                                    onClick={() => handleDelete(attachment)}
                                    title="Delete"
                                    style={{ color: 'var(--color-danger)' }}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="empty-state">
                    No attachments yet.
                </div>
            )}

            {transcribeError && (
                <div className="audio-recorder-error" style={{ marginTop: 'var(--spacing-3)' }}>
                    {transcribeError}
                </div>
            )}
        </div>
    )
}
