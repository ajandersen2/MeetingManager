import { useState, useEffect } from 'react'
import { FolderOpen, Plus, Users, ChevronRight, Hash, Settings, User } from 'lucide-react'
import { api } from '../lib/api'
import { useAuth } from '../context/AuthContext'

export default function Sidebar({ selectedGroupId, onSelectGroup, onCreateGroup, onManageGroup, isOpen }) {
    const { user } = useAuth()
    const [groups, setGroups] = useState([])
    const [loading, setLoading] = useState(true)
    const [collapsed, setCollapsed] = useState(false)

    useEffect(() => {
        if (user) {
            fetchGroups()
        }
    }, [user])

    // Poll for group changes
    useEffect(() => {
        if (!user) return
        const interval = setInterval(fetchGroups, 30000) // Poll every 30s
        return () => clearInterval(interval)
    }, [user])

    const fetchGroups = async () => {
        try {
            const data = await api.get('/api/groups')
            setGroups(data || [])
        } catch (error) {
            console.error('Error fetching groups:', error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''} ${isOpen ? 'sidebar-open' : ''}`}>
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
