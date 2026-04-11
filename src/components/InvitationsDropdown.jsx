import { useState, useEffect, useRef } from 'react'
import { Mail, Check, X } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function InvitationsDropdown({ onInvitationAccepted }) {
    const { user } = useAuth()
    const [invitations, setInvitations] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (user) {
            fetchInvitations()
        }
    }, [user])

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setIsOpen(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [])

    // Poll for new invitations
    useEffect(() => {
        if (!user) return
        const interval = setInterval(fetchInvitations, 30000)
        return () => clearInterval(interval)
    }, [user])

    const fetchInvitations = async () => {
        if (!user) return
        try {
            const data = await api.get('/api/invitations')
            setInvitations(data || [])
        } catch (err) {
            // Silently fail
        }
    }

    const handleAccept = async (invitation) => {
        setLoading(true)
        try {
            await api.post(`/api/invitations/${invitation.id}/accept`)
            fetchInvitations()
            onInvitationAccepted?.()
        } catch (error) {
            console.error('Error accepting invitation:', error)
            alert('Failed to accept invitation. Please try again.')
        } finally {
            setLoading(false)
        }
    }

    const handleDecline = async (invitation) => {
        setLoading(true)
        try {
            await api.post(`/api/invitations/${invitation.id}/decline`)
            fetchInvitations()
        } catch (error) {
            console.error('Error declining invitation:', error)
        } finally {
            setLoading(false)
        }
    }

    if (invitations.length === 0) return null

    return (
        <div className="invitations-dropdown" ref={dropdownRef}>
            <button
                className="btn btn-ghost"
                onClick={() => setIsOpen(!isOpen)}
                title="Pending invitations"
            >
                <Mail size={18} />
                <span className="invitations-badge">{invitations.length}</span>
            </button>

            {isOpen && (
                <div className="invitations-menu">
                    <div className="invitations-menu-header">
                        Group Invitations
                    </div>
                    {invitations.map(inv => (
                        <div key={inv.id} className="invitation-card">
                            <div className="invitation-card-group">
                                {inv.meeting_groups?.name || inv.group_name || 'Unknown Group'}
                            </div>
                            <div className="invitation-card-from">
                                You've been invited to join this group
                            </div>
                            <div className="invitation-card-actions">
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={() => handleAccept(inv)}
                                    disabled={loading}
                                >
                                    <Check size={14} />
                                    Accept
                                </button>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDecline(inv)}
                                    disabled={loading}
                                >
                                    <X size={14} />
                                    Decline
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
