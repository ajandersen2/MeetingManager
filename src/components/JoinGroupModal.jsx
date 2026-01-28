import { useState } from 'react'
import { X, Hash, LogIn } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function JoinGroupModal({ isOpen, onClose, onJoined }) {
    const { user } = useAuth()
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
            // Find the group by join code
            const { data: group, error: findError } = await supabase
                .from('meeting_groups')
                .select('id, name')
                .eq('join_code', joinCode.toUpperCase().trim())
                .single()

            if (findError || !group) {
                setError('Invalid join code. Please check and try again.')
                setLoading(false)
                return
            }

            // Check if already a member
            const { data: existing } = await supabase
                .from('group_members')
                .select('id')
                .eq('group_id', group.id)
                .eq('user_id', user.id)
                .single()

            if (existing) {
                setError('You are already a member of this group')
                setLoading(false)
                return
            }

            // Join the group
            const { error: joinError } = await supabase
                .from('group_members')
                .insert({
                    group_id: group.id,
                    user_id: user.id,
                    role: 'member'
                })

            if (joinError) throw joinError

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
