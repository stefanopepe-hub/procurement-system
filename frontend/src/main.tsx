import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import itIT from 'antd/locale/it_IT'
import dayjs from 'dayjs'
import 'dayjs/locale/it'

import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/auth/Login'
import { SupplierList } from './pages/suppliers/SupplierList'
import { SupplierDetail } from './pages/suppliers/SupplierDetail'
import { SupplierForm } from './pages/suppliers/SupplierForm'
import { ContractList } from './pages/contracts/ContractList'
import { ContractDetail } from './pages/contracts/ContractDetail'
import { ContractForm } from './pages/contracts/ContractForm'
import { VendorRatingDashboard } from './pages/vendor_rating/VendorRatingDashboard'
import { SupplierRatingDetail } from './pages/vendor_rating/SupplierRatingDetail'
import { SurveyPage } from './pages/vendor_rating/SurveyPage'
import Dashboard from './pages/Dashboard'
import AdminPanel from './pages/AdminPanel'
import { useAuthStore, isAdmin } from './store/auth'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'

dayjs.locale('it')

function ProtectedRoute({
  children,
  adminOnly,
  superAdminOnly,
}: {
  children: React.ReactNode
  adminOnly?: boolean
  superAdminOnly?: boolean
}) {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (superAdminOnly && user?.role !== 'super_admin') return <Navigate to="/" replace />
  if (adminOnly && !isAdmin(user)) return <Navigate to="/suppliers" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/survey/:token" element={<SurveyPage />} />

      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />

        {/* Albo Fornitori – tutti gli utenti */}
        <Route path="suppliers" element={<SupplierList />} />
        <Route path="suppliers/:id" element={<SupplierDetail />} />
        <Route path="suppliers/new" element={
          <ProtectedRoute adminOnly><SupplierForm /></ProtectedRoute>
        } />
        <Route path="suppliers/:id/edit" element={
          <ProtectedRoute adminOnly><SupplierForm /></ProtectedRoute>
        } />

        {/* Database Contratti – solo admin */}
        <Route path="contracts" element={
          <ProtectedRoute adminOnly><ContractList /></ProtectedRoute>
        } />
        <Route path="contracts/new" element={
          <ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>
        } />
        <Route path="contracts/:id" element={
          <ProtectedRoute adminOnly><ContractDetail /></ProtectedRoute>
        } />
        <Route path="contracts/:id/edit" element={
          <ProtectedRoute adminOnly><ContractForm /></ProtectedRoute>
        } />

        {/* Vendor Rating – solo admin */}
        <Route path="vendor-rating" element={
          <ProtectedRoute adminOnly><VendorRatingDashboard /></ProtectedRoute>
        } />
        <Route path="vendor-rating/supplier/:supplier_id" element={
          <ProtectedRoute adminOnly><SupplierRatingDetail /></ProtectedRoute>
        } />

        {/* Admin Panel – solo super_admin */}
        <Route path="admin" element={
          <ProtectedRoute superAdminOnly><AdminPanel /></ProtectedRoute>
        } />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={itIT}
      theme={{
        token: {
          colorPrimary: '#1a3a5c',
          colorSuccess: '#389e0d',
          colorWarning: '#d48806',
          colorError: '#cf1322',
          borderRadius: 6,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        },
        components: {
          Layout: { siderBg: '#1a3a5c', triggerBg: '#132d47' },
          Menu: { darkItemBg: '#1a3a5c', darkSubMenuItemBg: '#132d47' },
        },
      }}
    >
      <AntApp>
        <ErrorBoundary>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </ErrorBoundary>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
)
