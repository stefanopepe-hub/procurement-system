import React, { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store/auth'

const { Text } = Typography

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
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #0d2137 0%, #1a3a5c 50%, #0d2137 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Logo Telethon */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <img
            src="/Telethon_logo CMYK.svg"
            alt="Fondazione Telethon"
            style={{ height: 64, marginBottom: 8 }}
          />
        </div>

        <Card
          style={{
            borderRadius: 16,
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            border: 'none',
          }}
          styles={{ body: { padding: '36px 40px' } }}
        >
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c', marginBottom: 4 }}>
              Sistema Procurement
            </div>
            <Text type="secondary" style={{ fontSize: 13 }}>
              Accesso riservato al personale autorizzato
            </Text>
          </div>

          {error && (
            <Alert
              message={error}
              type="error"
              showIcon
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
          )}

          <Form layout="vertical" onFinish={onFinish} size="large">
            <Form.Item
              name="username"
              label="Username o Email"
              rules={[{ required: true, message: 'Inserire username o email' }]}
            >
              <Input
                prefix={<UserOutlined style={{ color: '#bbb' }} />}
                placeholder="username o indirizzo email"
                autoComplete="username"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item
              name="password"
              label="Password"
              rules={[{ required: true, message: 'Inserire password' }]}
            >
              <Input.Password
                prefix={<LockOutlined style={{ color: '#bbb' }} />}
                placeholder="password"
                autoComplete="current-password"
                style={{ borderRadius: 8 }}
              />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0, marginTop: 8 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                block
                style={{
                  height: 44,
                  borderRadius: 8,
                  background: '#1a3a5c',
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Accedi
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)' }}>
            Sessione protetta con TLS · Autenticazione JWT · NIS2 compliant
          </Text>
        </div>
      </div>
    </div>
  )
}
