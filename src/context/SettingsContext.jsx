import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const SettingsContext = createContext({})

export const useSettings = () => useContext(SettingsContext)

export const SettingsProvider = ({ children }) => {
    const [settings, setSettings] = useState({
        ai_model: 'gpt-4o-mini',
        max_tokens: 2048,
        temperature: 0.7
    })
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchSettings()
    }, [])

    const fetchSettings = async () => {
        try {
            const { data, error } = await supabase
                .from('app_settings')
                .select('*')
                .single()

            if (error && error.code !== 'PGRST116') {
                console.error('Error fetching settings:', error)
            }

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
            const { error } = await supabase
                .from('app_settings')
                .update({
                    ...newSettings,
                    updated_at: new Date().toISOString()
                })
                .not('id', 'is', null) // Update the single row

            if (error) throw error

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
