import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Users, ChevronRight, Hash, Settings, User } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ selectedGroupId, onSelectGroup, onCreateGroup, onManageGroup }) {
    const { user } = useAuth()
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        if (user) {
            fetchGroups()
        }
    }, [user])

    const fetchGroups = async () => {
        try {
            // Get groups with meeting counts
            const { data, error } = await supabase
                .from('group_members')
                .select(`
          role,
          meeting_groups (
            id,
            name,
            join_code
          )
        `)
                .eq('user_id', user.id)

            if (error) throw error

            // Get meeting counts per group
            const { data: meetingCounts } = await supabase
                .from('meetings')
                .select('group_id')
                .not('group_id', 'is', null)

            const countMap = {}
            meetingCounts?.forEach(m => {
                countMap[m.group_id] = (countMap[m.group_id] || 0) + 1
            })

            const groupsWithCounts = data?.map(gm => ({
                ...gm.meeting_groups,
                role: gm.role,
                meetingCount: countMap[gm.meeting_groups?.id] || 0
            })).filter(g => g.id) || []

            setGroups(groupsWithCounts)
        } catch (error) {
            console.error('Error fetching groups:', error)
        } finally {
            setLoading(false)
        }
    }

    // Refresh groups when needed (called from parent)
    useEffect(() => {
        const channel = supabase
            .channel('group_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
                fetchGroups()
            })
            .subscribe()

        return () => supabase.removeChannel(channel)
    }, [user])

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
            <div className="sidebar-header">
                <h3 className="sidebar-title">
                    <FolderOpen size={18} />
                    {!collapsed && 'Groups'}
                </h3>
                <button
                    className="btn btn-ghost btn-icon btn-sm"
                    onClick={() => setCollapsed(!collapsed)}
                >
                    <ChevronRight size={16} style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.2s' }} />
                </button>
            </div>

            <nav className="sidebar-nav">
                {/* All Meetings */}
                <button
                    className={`sidebar-item ${selectedGroupId === null ? 'active' : ''}`}
                    onClick={() => onSelectGroup(null)}
                >
                    <Users size={16} />
                    {!collapsed && (
                        <>
                            <span>All Meetings</span>
                        </>
                    )}
                </button>

                {/* Groups List */}
                {!collapsed && <div className="sidebar-divider" />}

                {loading ? (
                    <div className="sidebar-loading">Loading...</div>
                ) : (
                    groups.map(group => (
                        <div key={group.id} className="sidebar-group-item">
                            <button
                                className={`sidebar-item ${selectedGroupId === group.id ? 'active' : ''}`}
                                onClick={() => onSelectGroup(group.id)}
                            >
                                <Hash size={16} />
                                {!collapsed && (
                                    <>
                                        <span className="sidebar-item-name">{group.name}</span>
                                        {group.meetingCount > 0 && (
                                            <span className="sidebar-badge">{group.meetingCount}</span>
                                        )}
                                    </>
                                )}
                            </button>
                            {!collapsed && (
                                <button
                                    className="sidebar-item-action"
                                    onClick={(e) => { e.stopPropagation(); onManageGroup(group) }}
                                    title="Manage group"
                                >
                                    <Settings size={14} />
                                </button>
                            )}
                        </div>
                    ))
                )}
            </nav>

            {/* User Info & Create Group */}
            <div className="sidebar-footer">
                {!collapsed && (
                    <div className="sidebar-user">
                        <User size={16} />
                        <span className="sidebar-user-email">{user?.email}</span>
                    </div>
                )}
                <button className="btn btn-primary btn-sm sidebar-create-btn" onClick={onCreateGroup}>
                    <Plus size={16} />
                    {!collapsed && 'New Group'}
                </button>
            </div>
        </aside>
    )
}
