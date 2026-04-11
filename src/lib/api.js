const API_BASE = import.meta.env.VITE_API_URL || ''

async function request(path, options = {}) {
  const token = localStorage.getItem('mm_token')
  const headers = {
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers,
  }

  // Only set Content-Type for non-FormData bodies
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.message || `Request failed: ${res.status}`)
  }

  // Handle empty responses
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) }),
  put: (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (path) => request(path, { method: 'DELETE' }),

  upload: (path, file) => {
    const formData = new FormData()
    formData.append('file', file)
    return request(path, { method: 'POST', body: formData })
  },

  uploadBlob: (path, blob, filename, contentType) => {
    const formData = new FormData()
    formData.append('file', blob, filename)
    return request(path, { method: 'POST', body: formData })
  },

  download: async (path) => {
    const token = localStorage.getItem('mm_token')
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...(token && { Authorization: `Bearer ${token}` }) },
    })
    if (!res.ok) throw new Error('Download failed')
    return res.blob()
  },
}

// Auth helpers
export function setToken(token) {
  localStorage.setItem('mm_token', token)
}

export function getToken() {
  return localStorage.getItem('mm_token')
}

export function clearToken() {
  localStorage.removeItem('mm_token')
}
