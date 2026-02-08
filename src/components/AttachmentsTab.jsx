import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
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
                const { data: { user } } = await supabase.auth.getUser()
                if (!user) return
                const { data } = await supabase
                    .from('user_api_keys')
                    .select('deepgram_api_key')
                    .eq('user_id', user.id)
                    .single()
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
            // Download the audio file from storage
            const { data: audioData, error: downloadError } = await supabase.storage
                .from('meeting-attachments')
                .download(attachment.file_path)

            if (downloadError) throw downloadError

            // Determine content type from extension
            const ext = attachment.file_name.toLowerCase().split('.').pop()
            const mimeTypes = {
                webm: 'audio/webm', mp3: 'audio/mpeg', wav: 'audio/wav',
                m4a: 'audio/mp4', ogg: 'audio/ogg', flac: 'audio/flac', aac: 'audio/aac'
            }
            const contentType = mimeTypes[ext] || 'audio/webm'

            const { data: { session } } = await supabase.auth.getSession()
            if (!session) throw new Error('Not authenticated')

            const projectUrl = import.meta.env.VITE_SUPABASE_URL
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
            const response = await fetch(`${projectUrl}/functions/v1/deepgram-transcribe`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'apikey': anonKey,
                    'Content-Type': contentType,
                    'x-deepgram-key': deepgramKey,
                },
                body: audioData,
            })

            if (!response.ok) {
                const errData = await response.json().catch(() => ({}))
                throw new Error(errData.error || `Transcription failed (${response.status})`)
            }

            const result = await response.json()

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
            const { data, error } = await supabase
                .from('meeting_attachments')
                .select('*')
                .eq('meeting_id', meetingId)
                .order('uploaded_at', { ascending: false })

            if (error) throw error
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
                const filePath = `${meetingId}/${Date.now()}_${file.name}`

                // Upload to storage
                const { error: uploadError } = await supabase.storage
                    .from('meeting-attachments')
                    .upload(filePath, file)

                if (uploadError) throw uploadError

                // Save to database
                const { error: dbError } = await supabase
                    .from('meeting_attachments')
                    .insert({
                        meeting_id: meetingId,
                        file_name: file.name,
                        file_path: filePath,
                        file_size: file.size
                    })

                if (dbError) throw dbError
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
            // Delete from storage
            await supabase.storage
                .from('meeting-attachments')
                .remove([attachment.file_path])

            // Delete from database
            const { error } = await supabase
                .from('meeting_attachments')
                .delete()
                .eq('id', attachment.id)

            if (error) throw error
            await fetchAttachments()
        } catch (error) {
            console.error('Error deleting attachment:', error)
            alert('Failed to delete attachment')
        }
    }

    const handleDownload = async (attachment) => {
        try {
            const { data, error } = await supabase.storage
                .from('meeting-attachments')
                .download(attachment.file_path)

            if (error) throw error

            const url = URL.createObjectURL(data)
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
