import React, { useEffect, useState } from 'react'
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, Select, Space,
  Divider, Button, Spin, Alert, message, Tabs, Badge,
} from 'antd'
import {
  TeamOutlined, FileTextOutlined, FileOutlined, AuditOutlined,
  SafetyCertificateOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, BookOutlined, DeleteOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { adminApi } from '../services/api'
import type { User, UserRole } from '../types'

const { Title, Text, Link } = Typography
const { Option } = Select

// ---- Types ----
interface AdminStats {
  total_suppliers: number
  total_contracts: number
  total_users: number
  total_documents: number
  total_audit_entries: number
}

interface AuditEntry {
  id: number
  user_id: number | null
  action: string
  resource_type: string
  resource_id: string | null
  ip_address: string | null
  status: string
  created_at: string | null
}

// ---- Role color/label helpers ----
const ROLE_COLOR: Record<string, string> = {
  super_admin: 'purple',
  admin: 'blue',
  viewer: 'green',
}
const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Ufficio Acquisti',
  viewer: 'Consultazione',
}

const ACTION_COLOR: Record<string, string> = {
  LOGIN: 'green',
  LOGIN_FAILED: 'red',
  LOGOUT: 'default',
  CREATE: 'blue',
  UPDATE: 'orange',
  DELETE: 'red',
  VIEW: 'default',
  CHANGE_PASSWORD: 'purple',
}

// ---- User Management Table ----
const UserManagementTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingId, setUpdatingId] = useState<number | null>(null)

  const loadUsers = async () => {
    setLoading(true)
    try {
      const res = await adminApi.listUsers()
      setUsers(res.data)
    } catch {
      message.error('Errore nel caricamento degli utenti')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadUsers() }, [])

  const handleRoleChange = async (userId: number, role: UserRole) => {
    setUpdatingId(userId)
    try {
      await adminApi.updateUser(userId, { role })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      message.success('Ruolo aggiornato')
    } catch {
      message.error('Errore nell\'aggiornamento del ruolo')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleStatusToggle = async (userId: number, is_active: boolean) => {
    setUpdatingId(userId)
    try {
      await adminApi.updateUser(userId, { is_active })
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, is_active } : u))
      message.success(is_active ? 'Utente attivato' : 'Utente disattivato')
    } catch {
      message.error('Errore nell\'aggiornamento dello stato')
    } finally {
      setUpdatingId(null)
    }
  }

  const columns = [
    {
      title: 'Utente',
      key: 'user',
      render: (_: unknown, record: User) => (
        <Space>
          <UserOutlined />
          <div>
            <Text strong>{record.full_name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              @{record.username} · {record.email}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Ruolo',
      key: 'role',
      width: 200,
      render: (_: unknown, record: User) => (
        <Select
          value={record.role}
          style={{ width: 160 }}
          loading={updatingId === record.id}
          onChange={(role) => handleRoleChange(record.id, role as UserRole)}
        >
          <Option value="viewer">
            <Tag color="green">Consultazione</Tag>
          </Option>
          <Option value="admin">
            <Tag color="blue">Ufficio Acquisti</Tag>
          </Option>
          <Option value="super_admin">
            <Tag color="purple">Super Admin</Tag>
          </Option>
        </Select>
      ),
    },
    {
      title: 'Stato',
      key: 'is_active',
      width: 100,
      render: (_: unknown, record: User) => (
        record.is_active
          ? <Tag icon={<CheckCircleOutlined />} color="success">Attivo</Tag>
          : <Tag icon={<CloseCircleOutlined />} color="error">Disattivo</Tag>
      ),
    },
    {
      title: 'Ultimo accesso',
      key: 'last_login',
      width: 160,
      render: (_: unknown, record: User) =>
        record.last_login
          ? dayjs(record.last_login).format('DD/MM/YYYY HH:mm')
          : <Text type="secondary">Mai</Text>,
    },
    {
      title: 'Azioni',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: User) => (
        <Button
          size="small"
          danger={record.is_active}
          loading={updatingId === record.id}
          onClick={() => handleStatusToggle(record.id, !record.is_active)}
        >
          {record.is_active ? 'Disattiva' : 'Attiva'}
        </Button>
      ),
    },
  ]

  return (
    <Table
      dataSource={users}
      columns={columns}
      rowKey="id"
      loading={loading}
      pagination={false}
      size="small"
    />
  )
}

// ---- Audit Log Table ----
const AuditLogTab: React.FC = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminApi.auditLog()
      .then(res => setEntries(res.data))
      .catch(() => message.error('Errore nel caricamento del log'))
      .finally(() => setLoading(false))
  }, [])

  const columns = [
    {
      title: 'Data/Ora',
      key: 'created_at',
      width: 150,
      render: (_: unknown, r: AuditEntry) =>
        r.created_at ? dayjs(r.created_at).format('DD/MM/YY HH:mm:ss') : '–',
    },
    {
      title: 'Azione',
      key: 'action',
      width: 150,
      render: (_: unknown, r: AuditEntry) => (
        <Tag color={ACTION_COLOR[r.action] || 'default'}>{r.action}</Tag>
      ),
    },
    {
      title: 'Risorsa',
      key: 'resource',
      render: (_: unknown, r: AuditEntry) => (
        <Text>
          <Text type="secondary">{r.resource_type}</Text>
          {r.resource_id && <Text> #{r.resource_id}</Text>}
        </Text>
      ),
    },
    {
      title: 'Utente ID',
      key: 'user_id',
      width: 90,
      render: (_: unknown, r: AuditEntry) =>
        r.user_id ? `#${r.user_id}` : <Text type="secondary">–</Text>,
    },
    {
      title: 'IP',
      key: 'ip',
      width: 130,
      render: (_: unknown, r: AuditEntry) =>
        <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.ip_address || '–'}</Text>,
    },
    {
      title: 'Stato',
      key: 'status',
      width: 90,
      render: (_: unknown, r: AuditEntry) => (
        <Tag color={r.status === 'success' ? 'green' : 'red'}>{r.status}</Tag>
      ),
    },
  ]

  return (
    <>
      <Alert
        type="info"
        showIcon
        message="Vengono mostrate le ultime 50 voci del registro. Il log è conforme NIS2 e GDPR Art. 30."
        style={{ marginBottom: 16 }}
      />
      <Table
        dataSource={entries}
        columns={columns}
        rowKey="id"
        loading={loading}
        pagination={false}
        size="small"
        scroll={{ x: 800 }}
      />
    </>
  )
}

// ---- GDPR Section ----
const GdprTab: React.FC = () => (
  <Row gutter={[16, 16]}>
    <Col xs={24} md={12}>
      <Card
        title={<><BookOutlined /> Registro Trattamenti (Art. 30 GDPR)</>}
        extra={<Tag color="blue">Art. 30 GDPR</Tag>}
      >
        <p>
          Il Registro delle Attività di Trattamento documenta come l'organizzazione
          tratta i dati personali, in conformità al Regolamento UE 2016/679.
        </p>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Link href="/gdpr/registro-trattamenti" target="_blank">
            Apri Registro Trattamenti →
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ultimo aggiornamento: verificare con il DPO
          </Text>
        </Space>
      </Card>
    </Col>

    <Col xs={24} md={12}>
      <Card
        title={<><DeleteOutlined /> Richieste Diritto all'Oblio (Art. 17 GDPR)</>}
        extra={<Tag color="orange">Art. 17 GDPR</Tag>}
      >
        <p>
          Gestione delle richieste di cancellazione dei dati personali ricevute
          da fornitori e soggetti interessati, con relativo registro delle risposte.
        </p>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Link href="/gdpr/diritto-oblio" target="_blank">
            Apri Richieste Diritto Oblio →
          </Link>
          <Text type="secondary" style={{ fontSize: 12 }}>
            Termine di risposta: 30 giorni dalla richiesta
          </Text>
        </Space>
      </Card>
    </Col>

    <Col xs={24}>
      <Card title="Note sulla conformità GDPR" size="small">
        <Row gutter={[8, 8]}>
          {[
            { label: 'Audit log attivo (NIS2)', ok: true },
            { label: 'Crittografia dati a riposo', ok: true },
            { label: 'Token JWT con scadenza', ok: true },
            { label: 'Blocco account dopo tentativi falliti', ok: true },
            { label: 'Registro Trattamenti Art. 30', ok: false, note: 'Da completare con DPO' },
            { label: 'DPIA per trattamenti ad alto rischio', ok: false, note: 'Da valutare' },
          ].map(item => (
            <Col key={item.label} xs={24} sm={12} md={8}>
              <Space>
                {item.ok
                  ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                  : <CloseCircleOutlined style={{ color: '#faad14' }} />}
                <span style={{ fontSize: 13 }}>
                  {item.label}
                  {item.note && (
                    <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                      {item.note}
                    </Text>
                  )}
                </span>
              </Space>
            </Col>
          ))}
        </Row>
      </Card>
    </Col>
  </Row>
)

// ---- Stats Cards ----
const StatsCards: React.FC<{ stats: AdminStats }> = ({ stats }) => (
  <Row gutter={[16, 16]}>
    <Col xs={12} sm={8} lg={4}>
      <Card size="small">
        <Statistic
          title="Fornitori"
          value={stats.total_suppliers}
          prefix={<TeamOutlined />}
          valueStyle={{ color: '#1a3a5c', fontSize: 22 }}
        />
      </Card>
    </Col>
    <Col xs={12} sm={8} lg={4}>
      <Card size="small">
        <Statistic
          title="Contratti"
          value={stats.total_contracts}
          prefix={<FileTextOutlined />}
          valueStyle={{ color: '#389e0d', fontSize: 22 }}
        />
      </Card>
    </Col>
    <Col xs={12} sm={8} lg={4}>
      <Card size="small">
        <Statistic
          title="Documenti"
          value={stats.total_documents}
          prefix={<FileOutlined />}
          valueStyle={{ color: '#d48806', fontSize: 22 }}
        />
      </Card>
    </Col>
    <Col xs={12} sm={8} lg={4}>
      <Card size="small">
        <Statistic
          title="Utenti"
          value={stats.total_users}
          prefix={<UserOutlined />}
          valueStyle={{ color: '#722ed1', fontSize: 22 }}
        />
      </Card>
    </Col>
    <Col xs={12} sm={8} lg={4}>
      <Card size="small">
        <Statistic
          title="Voci Audit"
          value={stats.total_audit_entries}
          prefix={<AuditOutlined />}
          valueStyle={{ color: '#08979c', fontSize: 22 }}
        />
      </Card>
    </Col>
  </Row>
)

// ---- Main AdminPanel ----
const AdminPanel: React.FC = () => {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)

  useEffect(() => {
    adminApi.stats()
      .then(res => setStats(res.data))
      .catch(() => message.error('Errore nel caricamento delle statistiche'))
      .finally(() => setStatsLoading(false))
  }, [])

  const tabItems = [
    {
      key: 'users',
      label: (
        <span>
          <UserOutlined /> Gestione Utenti
        </span>
      ),
      children: <UserManagementTab />,
    },
    {
      key: 'gdpr',
      label: (
        <span>
          <SafetyCertificateOutlined /> GDPR
        </span>
      ),
      children: <GdprTab />,
    },
    {
      key: 'audit',
      label: (
        <span>
          <AuditOutlined /> Audit Log
          {stats && (
            <Badge
              count={Math.min(stats.total_audit_entries, 50)}
              style={{ marginLeft: 6, backgroundColor: '#08979c' }}
            />
          )}
        </span>
      ),
      children: <AuditLogTab />,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8, color: '#722ed1' }} />
          Pannello Amministrazione
        </Title>
        <Text type="secondary">
          Accesso riservato ai Super Admin · Gestione utenti, GDPR e audit di sistema
        </Text>
      </div>

      {statsLoading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : stats ? (
        <>
          <StatsCards stats={stats} />
          <Divider />
        </>
      ) : null}

      <Tabs items={tabItems} defaultActiveKey="users" />
    </div>
  )
}

export default AdminPanel
