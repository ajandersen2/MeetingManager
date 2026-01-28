import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Check if credentials are valid (not empty and not placeholder values)
const isValidCredentials = (url, key) => {
    return url &&
        key &&
        url.startsWith('http') &&
        !url.includes('YOUR_SUPABASE') &&
        !key.includes('YOUR_SUPABASE')
}

// Create a mock client that does nothing (prevents crashes when not configured)
const createMockClient = () => ({
    auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
        signUp: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
        signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
        signOut: () => Promise.resolve({ error: null }),
    },
    from: () => ({
        select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }),
        insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: null, error: { message: 'Supabase not configured' } }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
        delete: () => ({ eq: () => Promise.resolve({ error: { message: 'Supabase not configured' } }) }),
    }),
    storage: {
        from: () => ({
            upload: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            download: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
            remove: () => Promise.resolve({ error: { message: 'Supabase not configured' } }),
        }),
    },
})

// Export either real client or mock depending on configuration
export const supabase = isValidCredentials(supabaseUrl, supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : createMockClient()

export const isSupabaseConfigured = isValidCredentials(supabaseUrl, supabaseAnonKey)
