import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/auth'

const { Title, Text } = Typography

export const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const { setUser } = useAuthStore()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError(null)
    try {
      const res = await authApi.login(values.username, values.password)
      localStorage.setItem('access_token', res.data.access_token)
      localStorage.setItem('refresh_token', res.data.refresh_token)
      setUser(res.data.user)
      navigate('/suppliers')
    } catch (err: any) {
      const status = err.response?.status
      if (status === 423) setError('Account temporaneamente bloccato. Riprovare tra 15 minuti.')
      else if (status === 401) setError('Credenziali non valide.')
      else setError('Errore di connessione. Verificare la rete.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #001529 0%, #1677ff 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <Card style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
        <Space direction="vertical" style={{ width: '100%' }} size={24}>
          <div style={{ textAlign: 'center' }}>
            <SafetyCertificateOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Title level={3} style={{ marginTop: 12, marginBottom: 4 }}>
              Procurement System
            </Title>
            <Text type="secondary">Fondazione Telethon</Text>
          </div>

          {error && <Alert message={error} type="error" showIcon />}

          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item name="username" rules={[{ required: true, message: 'Inserire username o email' }]}>
              <Input prefix={<UserOutlined />} placeholder="Username o Email" autoComplete="username" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Inserire password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" autoComplete="current-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block>
                Accedi
              </Button>
            </Form.Item>
          </Form>

          <Text type="secondary" style={{ fontSize: 11, display: 'block', textAlign: 'center' }}>
            Accesso riservato al personale autorizzato di Fondazione Telethon.
            Sessione protetta con cifratura TLS e autenticazione JWT.
          </Text>
        </Space>
      </Card>
    </div>
  )
}
