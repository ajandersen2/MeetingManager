import { useState } from 'react'
import { X, Hash, LogIn } from 'lucide-react'
import { api } from '../lib/api'

export default function JoinGroupModal({ isOpen, onClose, onJoined }) {
    const [joinCode, setJoinCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const handleJoin = async () => {
        if (!joinCode.trim()) {
            setError('Please enter a join code')
            return
        }

        setLoading(true)
        setError('')

        try {
            const group = await api.post('/api/groups/join', { joinCode: joinCode.trim() })
            onJoined?.(group)
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal join-group-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <LogIn size={24} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
                        Join a Group
                    </h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="form-group">
                        <label className="form-label">
                            <Hash size={14} style={{ marginRight: '4px' }} />
                            Group Code
                        </label>
                        <input
                            type="text"
                            className="form-input join-code-input"
                            value={joinCode}
                            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                            placeholder="XXXXXX"
                            maxLength={6}
                            style={{ textTransform: 'uppercase', letterSpacing: '0.15em', fontFamily: 'monospace', fontSize: '1.25rem', textAlign: 'center' }}
                        />
                        <p className="form-hint">Enter the 6-character code shared by the group owner</p>
                    </div>

                    {error && <p className="form-error">{error}</p>}
                </div>

                <div className="modal-footer">
                    <div></div>
                    <div className="modal-footer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={handleJoin}
                            disabled={loading || joinCode.length < 6}
                        >
                            {loading ? 'Joining...' : 'Join Group'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
