import React, { useState, useEffect, useCallback } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Tag, Badge, Tooltip } from 'antd'
import {
  TeamOutlined, FileTextOutlined, StarOutlined, DashboardOutlined,
  LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  SafetyCertificateOutlined, WarningOutlined, BellOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore, isAdmin } from '../../store/auth'
import { authApi, vendorRatingApi } from '../../services/api'
import dayjs from 'dayjs'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const STATUS_COLOR: Record<string, string> = {
  admin: 'blue',
  super_admin: 'purple',
  viewer: 'green',
}
const STATUS_LABEL: Record<string, string> = {
  admin: 'Ufficio Acquisti',
  super_admin: 'Super Admin',
  viewer: 'Consultazione',
}

interface PendingRequest {
  supplier_id: number
  ragione_sociale: string
  requested_at: string | null
  expires_at: string | null
  tipo: string | null
  request_id: number
}

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([])
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const admin = isAdmin(user)

  const fetchPendingCount = useCallback(async () => {
    if (!admin) return
    try {
      const res = await vendorRatingApi.pendingCount()
      const data = res.data
      setPendingCount(data.pending ?? 0)
      setPendingRequests(data.requests ?? [])
    } catch {
      // silently ignore — non mostrare badge se l'endpoint fallisce
    }
  }, [admin])

  useEffect(() => {
    if (!admin) return
    fetchPendingCount()
    const interval = setInterval(fetchPendingCount, 5 * 60 * 1000) // ogni 5 minuti
    return () => clearInterval(interval)
  }, [admin, fetchPendingCount])

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/suppliers',
      icon: <TeamOutlined />,
      label: 'Albo Fornitori',
    },
    ...(admin ? [
      {
        key: '/contracts',
        icon: <FileTextOutlined />,
        label: 'Database Contratti',
      },
      {
        key: '/vendor-rating',
        icon: (
          <Badge count={pendingCount} size="small" offset={[4, -4]} style={{ boxShadow: 'none' }}>
            <StarOutlined />
          </Badge>
        ),
        label: 'Vendor Rating',
      },
      {
        key: '/non-conformita',
        icon: <WarningOutlined />,
        label: 'Non Conformità',
      },
    ] : []),
    ...(user?.role === 'super_admin' ? [
      {
        key: '/admin',
        icon: <SafetyCertificateOutlined />,
        label: 'Amministrazione',
      },
    ] : []),
  ]

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
  }

  const userMenu = {
    items: [
      { key: 'profile', label: user?.full_name, icon: <UserOutlined />, disabled: true },
      { type: 'divider' as const },
      { key: 'logout', label: 'Esci', icon: <LogoutOutlined />, danger: true, onClick: handleLogout },
    ],
  }

  // Dropdown notifiche campana
  const bellDropdownItems = pendingRequests.slice(0, 5).map((r, idx) => {
    const daysLeft = r.expires_at
      ? dayjs(r.expires_at).diff(dayjs(), 'day')
      : null
    return {
      key: `pending-${idx}`,
      label: (
        <div
          style={{ padding: '4px 0', cursor: 'pointer', minWidth: 260 }}
          onClick={() => navigate(`/vendor-rating/supplier/${r.supplier_id}`)}
        >
          <div style={{ fontWeight: 600, fontSize: 13 }}>
            {r.ragione_sociale}
          </div>
          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
            Richiesta il {r.requested_at ? dayjs(r.requested_at).format('DD/MM/YYYY') : '—'}
            {daysLeft !== null && (
              <span style={{ marginLeft: 8, color: daysLeft <= 7 ? '#cf1322' : '#d48806', fontWeight: 600 }}>
                · {daysLeft}gg rimasti
              </span>
            )}
          </div>
        </div>
      ),
    }
  })

  const bellDropdown = {
    items: pendingCount === 0
      ? [{ key: 'empty', label: <Text type="secondary" style={{ fontSize: 13 }}>Nessuna valutazione in attesa</Text>, disabled: true }]
      : [
          ...bellDropdownItems,
          ...(pendingCount > 5 ? [{ type: 'divider' as const }] : []),
          ...(pendingCount > 5 ? [{
            key: 'view-all',
            label: (
              <div
                style={{ textAlign: 'center', color: '#1a3a5c', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => navigate('/vendor-rating')}
              >
                Vedi tutte ({pendingCount})
              </div>
            ),
          }] : []),
        ],
  }

  const selectedKey = '/' + location.pathname.split('/')[1]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        style={{ background: '#1a3a5c' }}
        width={220}
      >
        <div style={{
          padding: collapsed ? '14px 8px' : '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
          borderBottom: '1px solid rgba(255,255,255,0.12)',
          marginBottom: 4,
          transition: 'padding 0.2s',
          minHeight: 64,
        }}>
          {collapsed ? (
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: '#E31837', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>T</span>
            </div>
          ) : (
            <img
              src="/telethon-logo.svg"
              alt="Fondazione Telethon"
              style={{ height: 36, filter: 'brightness(0) invert(1)', opacity: 0.92 }}
            />
          )}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>

      <Layout>
        <Header style={{
          background: '#fff', padding: '0 24px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <Space>
            <Tag color={STATUS_COLOR[user?.role || 'viewer']}>
              {STATUS_LABEL[user?.role || 'viewer']}
            </Tag>
            {admin && (
              <Dropdown menu={bellDropdown} trigger={['click']} placement="bottomRight">
                <Tooltip title={pendingCount > 0 ? `${pendingCount} valutazioni in attesa` : 'Nessuna valutazione in attesa'}>
                  <Badge count={pendingCount} size="small" style={{ cursor: 'pointer' }}>
                    <BellOutlined
                      style={{
                        fontSize: 18,
                        cursor: 'pointer',
                        color: pendingCount > 0 ? '#cf1322' : '#8c8c8c',
                        padding: '0 4px',
                      }}
                    />
                  </Badge>
                </Tooltip>
              </Dropdown>
            )}
            <Dropdown menu={userMenu} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar icon={<UserOutlined />} style={{ background: '#1a3a5c' }} />
                <Text>{user?.full_name}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        <Content style={{ margin: '24px', minHeight: 'calc(100vh - 112px)' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
