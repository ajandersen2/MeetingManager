import { useState, useEffect } from 'react'
import { X, Copy, Check, Mail, Trash2, LogOut, Users, Hash, Clock, UserCheck, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function GroupModal({ group, isOpen, onClose, onSave }) {
    const { user } = useAuth()
    const [name, setName] = useState('')
    const [members, setMembers] = useState([])
    const [invitations, setInvitations] = useState([])
    const [inviteEmail, setInviteEmail] = useState('')
    const [copied, setCopied] = useState(false)
    const [saving, setSaving] = useState(false)
    const [inviting, setInviting] = useState(false)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    const isEditing = !!group
    const isOwner = group?.role === 'owner' || !group

    useEffect(() => {
        if (group) {
            setName(group.name)
            fetchMembers()
            fetchInvitations()
        } else {
            setName('')
            setMembers([])
            setInvitations([])
        }
        setError('')
        setSuccess('')
    }, [group])

    const fetchMembers = async () => {
        if (!group?.id) return

        const { data, error } = await supabase
            .from('group_members')
            .select(`
        id,
        role,
        user_id,
        user_profiles (display_name)
      `)
            .eq('group_id', group.id)

        if (!error && data) {
            const membersWithInfo = data.map(m => ({
                ...m,
                display_name: m.user_profiles?.display_name || 'Unknown User',
                isCurrentUser: m.user_id === user?.id
            }))
            setMembers(membersWithInfo)
        }
    }

    const fetchInvitations = async () => {
        if (!group?.id) return

        const { data, error } = await supabase
            .from('group_invitations')
            .select('*')
            .eq('group_id', group.id)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })

        if (!error && data) {
            setInvitations(data)
        }
    }

    const generateJoinCode = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
        let code = ''
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        return code
    }

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Group name is required')
            return
        }

        setSaving(true)
        setError('')

        try {
            if (isEditing) {
                const { error } = await supabase
                    .from('meeting_groups')
                    .update({ name: name.trim() })
                    .eq('id', group.id)

                if (error) throw error
            } else {
                const joinCode = generateJoinCode()
                const { data: newGroup, error: createError } = await supabase
                    .from('meeting_groups')
                    .insert({
                        name: name.trim(),
                        join_code: joinCode,
                        created_by: user.id
                    })
                    .select()
                    .single()

                if (createError) throw createError

                const { error: memberError } = await supabase
                    .from('group_members')
                    .insert({
                        group_id: newGroup.id,
                        user_id: user.id,
                        role: 'owner'
                    })

                if (memberError) throw memberError
            }

            onSave?.()
            onClose()
        } catch (err) {
            setError(err.message)
        } finally {
            setSaving(false)
        }
    }

    const handleCopyCode = () => {
        navigator.clipboard.writeText(group?.join_code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleInvite = async () => {
        const email = inviteEmail.trim().toLowerCase()
        if (!email) return

        // Basic email validation
        if (!email.includes('@') || !email.includes('.')) {
            setError('Please enter a valid email address')
            return
        }

        setInviting(true)
        setError('')
        setSuccess('')

        try {
            // Check if already invited
            const existingInvite = invitations.find(i => i.email === email)
            if (existingInvite) {
                setError('This email has already been invited')
                setInviting(false)
                return
            }

            // Create invitation
            const { error: inviteError } = await supabase
                .from('group_invitations')
                .insert({
                    group_id: group.id,
                    email: email,
                    invited_by: user.id,
                    status: 'pending'
                })

            if (inviteError) {
                if (inviteError.code === '23505') {
                    setError('This email has already been invited')
                } else {
                    throw inviteError
                }
                setInviting(false)
                return
            }

            // Get current user's profile for inviter name
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('display_name')
                .eq('user_id', user.id)
                .single()

            // Send invitation email via Edge Function
            try {
                await supabase.functions.invoke('send-invitation-email', {
                    body: {
                        email: email,
                        groupName: group.name,
                        inviterName: profile?.display_name || user.email,
                        joinCode: group.join_code
                    }
                })
            } catch (emailError) {
                // Email sending failed but invitation was created - log but don't fail
                console.warn('Email sending failed:', emailError)
            }

            setSuccess(`Invitation sent to ${email}`)
            setInviteEmail('')
            fetchInvitations()
        } catch (err) {
            setError(err.message)
        } finally {
            setInviting(false)
        }
    }

    const handleCancelInvitation = async (invitationId) => {
        try {
            const { error } = await supabase
                .from('group_invitations')
                .delete()
                .eq('id', invitationId)

            if (error) throw error
            fetchInvitations()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleRemoveMember = async (memberId, memberUserId) => {
        if (!confirm('Remove this member from the group?')) return

        try {
            const { error } = await supabase
                .from('group_members')
                .delete()
                .eq('id', memberId)

            if (error) throw error

            if (memberUserId === user.id) {
                onSave?.()
                onClose()
            } else {
                fetchMembers()
            }
        } catch (err) {
            setError(err.message)
        }
    }

    const handleDeleteGroup = async () => {
        if (!confirm('Delete this group? Meetings will become ungrouped (not deleted).')) return

        try {
            const { error } = await supabase
                .from('meeting_groups')
                .delete()
                .eq('id', group.id)

            if (error) throw error
            onSave?.()
            onClose()
        } catch (err) {
            setError(err.message)
        }
    }

    const handleLeaveGroup = async () => {
        if (!confirm('Leave this group? You can rejoin with the group code.')) return

        const myMembership = members.find(m => m.user_id === user.id)
        if (myMembership) {
            await handleRemoveMember(myMembership.id, user.id)
        }
    }

    if (!isOpen) return null

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal group-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <Hash size={24} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
                        {isEditing ? 'Manage Group' : 'Create Group'}
                    </h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Group Name */}
                    <div className="form-group">
                        <label className="form-label required">Group Name</label>
                        <input
                            type="text"
                            className="form-input"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Engineering Team"
                            disabled={!isOwner && isEditing}
                        />
                    </div>

                    {/* Join Code */}
                    {isEditing && (
                        <div className="form-group">
                            <label className="form-label">Join Code</label>
                            <div className="group-code-container">
                                <code className="group-code">{group?.join_code}</code>
                                <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={handleCopyCode}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                    {copied ? 'Copied!' : 'Copy'}
                                </button>
                            </div>
                            <p className="form-hint">Share this code with others so they can join the group</p>
                        </div>
                    )}

                    {/* Invite by Email (owners only) */}
                    {isEditing && isOwner && (
                        <div className="form-group">
                            <label className="form-label">
                                <Mail size={14} style={{ marginRight: '4px' }} />
                                Invite by Email
                            </label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                <input
                                    type="email"
                                    className="form-input"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="email@example.com"
                                    onKeyDown={(e) => e.key === 'Enter' && handleInvite()}
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleInvite}
                                    disabled={inviting || !inviteEmail.trim()}
                                >
                                    {inviting ? 'Sending...' : 'Invite'}
                                </button>
                            </div>
                            <p className="form-hint">They'll be notified and can accept or decline the invitation</p>
                        </div>
                    )}

                    {/* Pending Invitations */}
                    {isEditing && isOwner && invitations.length > 0 && (
                        <div className="form-group">
                            <label className="form-label">
                                <Clock size={14} style={{ marginRight: '4px' }} />
                                Pending Invitations ({invitations.length})
                            </label>
                            <div className="group-invitations-list">
                                {invitations.map(inv => (
                                    <div key={inv.id} className="group-invitation-item">
                                        <div className="group-invitation-info">
                                            <Mail size={14} />
                                            <span>{inv.email}</span>
                                            <span className="group-invitation-badge">Pending</span>
                                        </div>
                                        <button
                                            className="btn btn-ghost btn-icon btn-sm"
                                            onClick={() => handleCancelInvitation(inv.id)}
                                            title="Cancel invitation"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Members List */}
                    {isEditing && (
                        <div className="form-group">
                            <label className="form-label">
                                <Users size={14} style={{ marginRight: '4px' }} />
                                Members ({members.length})
                            </label>
                            <div className="group-members-list">
                                {members.map(member => (
                                    <div key={member.id} className="group-member-item">
                                        <div className="group-member-info">
                                            <UserCheck size={14} />
                                            <span className="group-member-name">
                                                {member.display_name}
                                                {member.isCurrentUser && ' (you)'}
                                            </span>
                                            {member.role === 'owner' && (
                                                <span className="group-member-badge">Owner</span>
                                            )}
                                        </div>
                                        {(isOwner && !member.isCurrentUser) || member.isCurrentUser ? (
                                            <button
                                                className="btn btn-ghost btn-icon btn-sm"
                                                onClick={() => handleRemoveMember(member.id, member.user_id)}
                                                title={member.isCurrentUser ? 'Leave group' : 'Remove member'}
                                            >
                                                {member.isCurrentUser ? <LogOut size={14} /> : <X size={14} />}
                                            </button>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {error && <p className="form-error">{error}</p>}
                    {success && <p className="form-success">{success}</p>}
                </div>

                <div className="modal-footer">
                    <div>
                        {isEditing && isOwner && (
                            <button className="btn btn-danger btn-icon" onClick={handleDeleteGroup} title="Delete group">
                                <Trash2 size={18} />
                            </button>
                        )}
                        {isEditing && !isOwner && (
                            <button className="btn btn-secondary" onClick={handleLeaveGroup}>
                                <LogOut size={14} />
                                Leave Group
                            </button>
                        )}
                    </div>
                    <div className="modal-footer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        {(isOwner || !isEditing) && (
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Saving...' : (isEditing ? 'Save Changes' : 'Create Group')}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
