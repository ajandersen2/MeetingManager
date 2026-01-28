import { useState, useEffect, useRef } from 'react'
import { Mail, Check, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function InvitationsDropdown({ onInvitationAccepted }) {
    const { user } = useAuth()
    const [invitations, setInvitations] = useState([])
    const [isOpen, setIsOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const dropdownRef = useRef(null)

    useEffect(() => {
        if (user?.email) {
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

    // Realtime subscription for new invitations
    useEffect(() => {
        if (!user?.email) return

        const channel = supabase
            .channel('invitation_changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'group_invitations',
                filter: `email=eq.${user.email}`
            }, () => {
                fetchInvitations()
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [user])

    const fetchInvitations = async () => {
        if (!user?.email) return

        const { data, error } = await supabase
            .from('group_invitations')
            .select(`
        *,
        meeting_groups (name)
      `)
            .eq('email', user.email)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setInvitations(data)
        }
    }

    const handleAccept = async (invitation) => {
        setLoading(true)
        try {
            // Add user to group
            const { error: memberError } = await supabase
                .from('group_members')
                .insert({
                    group_id: invitation.group_id,
                    user_id: user.id,
                    role: 'member'
                })

            if (memberError) throw memberError

            // Update invitation status
            const { error: updateError } = await supabase
                .from('group_invitations')
                .update({
                    status: 'accepted',
                    responded_at: new Date().toISOString()
                })
                .eq('id', invitation.id)

            if (updateError) throw updateError

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
            const { error } = await supabase
                .from('group_invitations')
                .update({
                    status: 'declined',
                    responded_at: new Date().toISOString()
                })
                .eq('id', invitation.id)

            if (error) throw error
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
                                {inv.meeting_groups?.name || 'Unknown Group'}
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
