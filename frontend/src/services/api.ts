import axios from 'axios'

const API_BASE = ((window as any).__API_URL__ || import.meta.env.VITE_API_URL || '') + '/api/v1'

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-refresh on 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = localStorage.getItem('refresh_token')
      if (refreshToken) {
        try {
          const res = await axios.post(API_BASE + '/auth/refresh', { refresh_token: refreshToken })
          localStorage.setItem('access_token', res.data.access_token)
          localStorage.setItem('refresh_token', res.data.refresh_token)
          original.headers.Authorization = `Bearer ${res.data.access_token}`
          return api(original)
        } catch {
          localStorage.clear()
          window.location.href = '/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api

// ---- Auth ----
export const authApi = {
  login: (username: string, password: string) =>
    api.post('/auth/login', { username, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  listUsers: () => api.get('/auth/users'),
  createUser: (data: object) => api.post('/auth/users', data),
  updateUser: (id: number, data: object) => api.patch(`/auth/users/${id}`, data),
}

// ---- Suppliers ----
export const suppliersApi = {
  list: (params?: object) => api.get('/suppliers', { params }),
  get: (id: number) => api.get(`/suppliers/${id}`),
  create: (data: object) => api.post('/suppliers', data),
  update: (id: number, data: object) => api.patch(`/suppliers/${id}`, data),
  addContact: (supplierId: number, data: object) =>
    api.post(`/suppliers/${supplierId}/contacts`, data),
  updateContact: (supplierId: number, contactId: number, data: object) =>
    api.put(`/suppliers/${supplierId}/contacts/${contactId}`, data),
  deleteContact: (supplierId: number, contactId: number) =>
    api.delete(`/suppliers/${supplierId}/contacts/${contactId}`),
  addCertification: (supplierId: number, data: object) =>
    api.post(`/suppliers/${supplierId}/certifications`, data),
  addFatturato: (supplierId: number, data: object) =>
    api.post(`/suppliers/${supplierId}/fatturato`, data),
  uploadDocument: (supplierId: number, tipo: string, file: File, dataScadenza?: string) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/suppliers/${supplierId}/documents?tipo=${tipo}${dataScadenza ? '&data_scadenza=' + dataScadenza : ''}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getOrders: (supplierCode: string) =>
    api.get(`/alyante/orders/${supplierCode}`),
  downloadDocument: (docId: number) =>
    api.get(`/suppliers/documents/${docId}/download`, { responseType: 'blob' }),
}

// ---- Contracts ----
export const contractsApi = {
  list: (params?: object) => api.get('/contracts', { params }),
  get: (id: number) => api.get(`/contracts/${id}`),
  create: (data: object) => api.post('/contracts', data),
  update: (id: number, data: object) => api.patch(`/contracts/${id}`, data),
  delete: (id: number) => api.delete(`/contracts/${id}`),
  uploadDocument: (contractId: number, tipo: string, file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post(`/contracts/${contractId}/documents?tipo=${tipo}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
}

// ---- AI Analysis ----
export const aiApi = {
  analyzeContract: (contractId: number, documentId: number) =>
    api.post(`/ai/contracts/${contractId}/analyze/${documentId}`),
}

// ---- Admin (super_admin only) ----
export const adminApi = {
  stats: () => api.get('/auth/admin/stats'),
  auditLog: () => api.get('/auth/admin/audit-log'),
  listUsers: () => api.get('/auth/users'),
  updateUser: (id: number, data: object) => api.patch(`/auth/users/${id}`, data),
  createUser: (data: object) => api.post('/auth/users', data),
}

// ---- Vendor Rating ----
export const vendorRatingApi = {
  dashboard: (params?: object) => api.get('/vendor-rating/dashboard', { params }),
  supplierRatings: (supplierId: number) =>
    api.get(`/vendor-rating/supplier/${supplierId}/ratings`),
  supplierSummary: (supplierId: number) =>
    api.get(`/vendor-rating/supplier/${supplierId}/summary`),
  getSurvey: (token: string) => api.get(`/vendor-rating/survey/${token}`),
  submitSurvey: (data: object) => api.post('/vendor-rating/survey/submit', data),
  createRequest: (data: object) => api.post('/vendor-rating/requests', data),
  listUaReviews: (supplierId: number) =>
    api.get(`/vendor-rating/supplier/${supplierId}/ua-reviews`),
  createUaReview: (supplierId: number, data: object) =>
    api.post(`/vendor-rating/supplier/${supplierId}/ua-reviews`, data),
  listNc: (params?: object) => api.get('/vendor-rating/non-conformita', { params }),
}
