import { createContext, useContext, useState, useEffect } from 'react'
import { api } from '../lib/api'

const SettingsContext = createContext({})

export const useSettings = () => useContext(SettingsContext)

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        ai_model: 'gpt-4o-mini',
        max_tokens: 8192,
        temperature: 0.7
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const data = await api.get('/api/settings')
            if (data) {
                setSettings({
                    ai_model: data.ai_model,
                    max_tokens: data.max_tokens,
                    temperature: parseFloat(data.temperature)
                })
            }
        } catch (error) {
            console.error('Error fetching settings:', error)
        } finally {
            setLoading(false)
        }
    }

    const updateSettings = async (newSettings) => {
        try {
            await api.put('/api/settings', newSettings)
            setSettings(prev => ({ ...prev, ...newSettings }))
            return { success: true }
        } catch (error) {
            console.error('Error updating settings:', error)
            return { success: false, error }
        }
    }

    return (
        <SettingsContext.Provider value={{ settings, updateSettings, loading }}>
            {children}
        </SettingsContext.Provider>
    )
}
