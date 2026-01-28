import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Upload, File, Trash2, Download } from 'lucide-react'

export default function AttachmentsTab({ meetingId }) {
    const [attachments, setAttachments] = useState([])
    const [uploading, setUploading] = useState(false)
    const [loading, setLoading] = useState(true)
    const [dragOver, setDragOver] = useState(false)
    const fileInputRef = useRef(null)

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
                                <File size={20} style={{ color: 'var(--color-gray-400)' }} />
                                <div>
                                    <div className="attachment-name">{attachment.file_name}</div>
                                    <div className="attachment-size">{formatFileSize(attachment.file_size)}</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
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
        </div>
    )
}
