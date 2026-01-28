import { useState, useEffect } from 'react'
import { X, Settings, Sparkles, User } from 'lucide-react'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const AI_MODELS = [
    { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Recommended)', description: 'Fast, affordable, great quality' },
    { value: 'gpt-4o', label: 'GPT-4o', description: 'Best quality, more expensive' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fastest, most affordable' },
]

export default function SettingsModal({ isOpen, onClose }) {
    const { settings, updateSettings } = useSettings()
    const { user, userProfile, isAdmin } = useAuth()
    const [localSettings, setLocalSettings] = useState(settings)
    const [displayName, setDisplayName] = useState('')
    const [saving, setSaving] = useState(false)
    const [savingProfile, setSavingProfile] = useState(false)
    const [error, setError] = useState(null)
    const [profileSuccess, setProfileSuccess] = useState(false)

    useEffect(() => {
        if (userProfile?.display_name) {
            setDisplayName(userProfile.display_name)
        } else if (user?.email) {
            setDisplayName(user.email)
        }
    }, [userProfile, user])

    if (!isOpen) return null

    const handleSave = async () => {
        setSaving(true)
        setError(null)

        const result = await updateSettings(localSettings)

        if (result.success) {
            onClose()
        } else {
            setError('Failed to save settings. Make sure you have admin privileges.')
        }

        setSaving(false)
    }

    const handleSaveProfile = async () => {
        setSavingProfile(true)
        setError(null)
        setProfileSuccess(false)

        try {
            const { error } = await supabase
                .from('user_profiles')
                .update({ display_name: displayName })
                .eq('user_id', user.id)

            if (error) throw error
            setProfileSuccess(true)
            setTimeout(() => setProfileSuccess(false), 2000)
        } catch (err) {
            setError('Failed to update profile.')
        }

        setSavingProfile(false)
    }

    const handleModelChange = (e) => {
        setLocalSettings(prev => ({ ...prev, ai_model: e.target.value }))
    }

    const handleTokensChange = (e) => {
        setLocalSettings(prev => ({ ...prev, max_tokens: parseInt(e.target.value) }))
    }

    const handleTemperatureChange = (e) => {
        setLocalSettings(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))
    }

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal settings-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">
                        <Settings size={24} style={{ marginRight: '8px', color: 'var(--color-primary)' }} />
                        Settings
                    </h2>
                    <button className="btn btn-ghost btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* Profile Section - for all users */}
                    <div className="settings-section">
                        <h3 className="settings-section-title">
                            <User size={18} />
                            My Profile
                        </h3>

                        <div className="form-group">
                            <label className="form-label">Display Name</label>
                            <div style={{ display: 'flex', gap: 'var(--spacing-2)' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="Enter your name"
                                />
                                <button
                                    className="btn btn-primary"
                                    onClick={handleSaveProfile}
                                    disabled={savingProfile}
                                >
                                    {savingProfile ? 'Saving...' : profileSuccess ? '✓ Saved' : 'Save'}
                                </button>
                            </div>
                            <p className="settings-hint">
                                This name will appear when you're added as an attendee to meetings.
                            </p>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Email</label>
                            <input
                                type="text"
                                className="form-input"
                                value={user?.email || ''}
                                disabled
                                style={{ opacity: 0.7 }}
                            />
                        </div>
                    </div>

                    {/* AI Settings Section - admin only */}
                    {isAdmin && (
                        <div className="settings-section">
                            <h3 className="settings-section-title">
                                <Sparkles size={18} />
                                AI Configuration (Admin)
                            </h3>

                            <div className="form-group">
                                <label className="form-label">AI Model</label>
                                <select
                                    className="form-input"
                                    value={localSettings.ai_model}
                                    onChange={handleModelChange}
                                >
                                    {AI_MODELS.map(model => (
                                        <option key={model.value} value={model.value}>
                                            {model.label}
                                        </option>
                                    ))}
                                </select>
                                <p className="settings-hint">
                                    {AI_MODELS.find(m => m.value === localSettings.ai_model)?.description}
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Max Tokens: <strong>{localSettings.max_tokens}</strong>
                                </label>
                                <input
                                    type="range"
                                    className="settings-slider"
                                    min="500"
                                    max="4000"
                                    step="100"
                                    value={localSettings.max_tokens}
                                    onChange={handleTokensChange}
                                />
                                <div className="settings-range-labels">
                                    <span>500</span>
                                    <span>4000</span>
                                </div>
                                <p className="settings-hint">
                                    Controls the maximum length of AI-generated content. Higher = longer output.
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Temperature: <strong>{localSettings.temperature.toFixed(1)}</strong>
                                </label>
                                <input
                                    type="range"
                                    className="settings-slider"
                                    min="0"
                                    max="1"
                                    step="0.1"
                                    value={localSettings.temperature}
                                    onChange={handleTemperatureChange}
                                />
                                <div className="settings-range-labels">
                                    <span>0 (Focused)</span>
                                    <span>1 (Creative)</span>
                                </div>
                                <p className="settings-hint">
                                    Lower = more consistent and focused. Higher = more creative and varied.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="settings-error">
                            {error}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <div></div>
                    <div className="modal-footer-actions">
                        <button className="btn btn-secondary" onClick={onClose}>
                            {isAdmin ? 'Cancel' : 'Close'}
                        </button>
                        {isAdmin && (
                            <button
                                className="btn btn-primary"
                                onClick={handleSave}
                                disabled={saving}
                            >
                                {saving ? 'Saving...' : 'Save AI Settings'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
