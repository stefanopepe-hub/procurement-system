import React, { useState } from 'react'
import { Layout, Menu, Avatar, Dropdown, Button, Space, Typography, Tag } from 'antd'
import {
  TeamOutlined, FileTextOutlined, StarOutlined, DashboardOutlined,
  LogoutOutlined, UserOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation, Outlet } from 'react-router-dom'
import { useAuthStore, isAdmin } from '../../store/auth'
import { authApi } from '../../services/api'

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

export const AppLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const admin = isAdmin(user)

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
        icon: <StarOutlined />,
        label: 'Vendor Rating',
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
          padding: collapsed ? '16px 8px' : '16px 24px',
          display: 'flex', alignItems: 'center', gap: 8,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          marginBottom: 8,
          transition: 'padding 0.2s',
        }}>
          <DashboardOutlined style={{ color: '#4a9eff', fontSize: 20 }} />
          {!collapsed && (
            <Text style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>
              Procurement
            </Text>
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
