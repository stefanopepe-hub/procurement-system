import React, { useEffect, useState } from 'react'
import {
  Typography, Card, Row, Col, Statistic, Table, Tag, Select, Space,
  Divider, Button, Spin, Alert, message, Tabs, Badge, Input,
} from 'antd'
import {
  TeamOutlined, FileTextOutlined, FileOutlined, AuditOutlined,
  SafetyCertificateOutlined, UserOutlined, CheckCircleOutlined,
  CloseCircleOutlined, BookOutlined, DeleteOutlined, ArrowRightOutlined,
  SendOutlined, DatabaseOutlined, LinkOutlined, CopyOutlined, WarningOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { adminApi } from '../services/api'
import type { User, UserRole } from '../types'

const { Title, Text } = Typography
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
const GdprTab: React.FC = () => {
  const navigate = useNavigate()
  return (
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
          <Button
            type="link"
            icon={<ArrowRightOutlined />}
            style={{ padding: 0 }}
            onClick={() => navigate('/gdpr/registro-trattamenti')}
          >
            Apri Registro Trattamenti
          </Button>
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
          <Button
            type="link"
            icon={<ArrowRightOutlined />}
            style={{ padding: 0 }}
            onClick={() => navigate('/gdpr/diritto-oblio')}
          >
            Apri Richieste Diritto Oblio
          </Button>
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
}

// ---- UAT / Test Tab ----
const UatTab: React.FC = () => {
  const [emailTo, setEmailTo] = useState('pepe@tigem.it')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailResult, setEmailResult] = useState<any>(null)
  const [runningSeed, setRunningSeed] = useState(false)
  const [seedResult, setSeedResult] = useState<string | null>(null)
  const [checkingExpiries, setCheckingExpiries] = useState(false)

  const handleSendTestEmail = async () => {
    setSendingEmail(true)
    setEmailResult(null)
    try {
      const res = await adminApi.sendTestEmail(emailTo)
      setEmailResult(res.data)
      if (res.data.status === 'sent') {
        message.success('Email inviata con successo!')
      } else {
        message.warning('SMTP non configurato — usa il link survey direttamente')
      }
    } catch (err: any) {
      message.error('Errore: ' + (err.response?.data?.detail || 'Errore sconosciuto'))
    } finally {
      setSendingEmail(false)
    }
  }

  const handleRunSeed = async () => {
    setRunningSeed(true)
    setSeedResult(null)
    try {
      const res = await adminApi.runSeed()
      setSeedResult(res.data.detail || 'Seed completato')
      message.success('Seed database eseguito con successo!')
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Errore sconosciuto'
      setSeedResult('Errore: ' + detail)
      message.error('Errore nel seed: ' + detail)
    } finally {
      setRunningSeed(false)
    }
  }

  const handleCheckExpiries = async () => {
    setCheckingExpiries(true)
    try {
      await adminApi.checkExpiries()
      message.success('Verifica scadenze contratti completata')
    } catch {
      message.info('Funzione completata (o SMTP non configurato)')
    } finally {
      setCheckingExpiries(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => message.success('Copiato!'))
      .catch(() => message.info('Copia manuale: ' + text))
  }

  return (
    <div>
      <Alert
        type="info"
        showIcon
        message="Pannello UAT — Strumenti per il test dell'applicazione"
        description="Usa queste funzioni per verificare il funzionamento del sistema prima del Go-Live."
        style={{ marginBottom: 24, borderRadius: 8 }}
      />

      <Row gutter={[16, 16]}>
        {/* Email di Test */}
        <Col xs={24} lg={12}>
          <Card
            title={<><SendOutlined style={{ color: '#1a3a5c', marginRight: 8 }} />Email Vendor Rating – Test</>}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text strong style={{ fontSize: 13 }}>Destinatario email di test:</Text>
                <Input
                  value={emailTo}
                  onChange={e => setEmailTo(e.target.value)}
                  placeholder="pepe@tigem.it"
                  style={{ marginTop: 6 }}
                />
              </div>
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={sendingEmail}
                onClick={handleSendTestEmail}
                block
                style={{ background: '#1a3a5c', borderColor: '#1a3a5c' }}
              >
                Invia Email Vendor Rating a {emailTo}
              </Button>

              {emailResult && (
                <div style={{ marginTop: 8 }}>
                  <Alert
                    type={emailResult.status === 'sent' ? 'success' : 'warning'}
                    showIcon
                    message={emailResult.status === 'sent'
                      ? `Email inviata a ${emailResult.email_to}`
                      : 'SMTP non configurato — usa il link survey'}
                    style={{ marginBottom: 12, borderRadius: 8 }}
                  />
                  {emailResult.survey_url && (
                    <div style={{
                      background: '#f8faff', border: '1px solid #d6e4ff',
                      borderRadius: 8, padding: '12px 16px',
                    }}>
                      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        <LinkOutlined style={{ marginRight: 4 }} />Link Survey:
                      </Text>
                      <Text style={{ fontSize: 12, wordBreak: 'break-all', fontFamily: 'monospace' }}>
                        {emailResult.survey_url}
                      </Text>
                      <Button
                        size="small" icon={<CopyOutlined />}
                        onClick={() => copyToClipboard(emailResult.survey_url)}
                        style={{ marginTop: 8, width: '100%' }}
                      >
                        Copia Link Survey
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Alert
                type="info"
                showIcon
                message="Come funziona"
                description="Clicca il pulsante per creare una survey di valutazione e inviare l'email. Se SMTP non è configurato, copia il link e aprilo nel browser."
                style={{ borderRadius: 8, fontSize: 12 }}
              />
            </Space>
          </Card>
        </Col>

        {/* Seed Database */}
        <Col xs={24} lg={12}>
          <Card
            title={<><DatabaseOutlined style={{ color: '#722ed1', marginRight: 8 }} />Database Seed & Notifiche</>}
            style={{ height: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Il seed crea dati realistici se non presenti: 20 fornitori, 60 contratti, 120 valutazioni. È idempotente: non duplica dati esistenti.
                </Text>
              </div>
              <Button
                icon={<DatabaseOutlined />}
                loading={runningSeed}
                onClick={handleRunSeed}
                block
              >
                Esegui Seed Database
              </Button>
              {seedResult && (
                <Alert
                  type={seedResult.startsWith('Errore') ? 'error' : 'success'}
                  message={seedResult}
                  showIcon
                  style={{ borderRadius: 8 }}
                />
              )}

              <Divider style={{ margin: '8px 0' }} />

              <div>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Verifica manualmente le notifiche di scadenza contratti (job automatico alle 07:00).
                </Text>
              </div>
              <Button
                icon={<WarningOutlined />}
                loading={checkingExpiries}
                onClick={handleCheckExpiries}
                block
              >
                Verifica Scadenze Contratti ora
              </Button>
            </Space>
          </Card>
        </Col>

        {/* Scenari UAT */}
        <Col xs={24}>
          <Card title="Scenari UAT – Checklist per il test">
            {[
              {
                num: 1, title: 'Inserimento Nuovo Fornitore',
                steps: 'Vai in Albo Fornitori → Nuovo Fornitore → Compila il form → Salva. Verifica che il fornitore appaia nella lista.',
              },
              {
                num: 2, title: 'Creazione Contratto',
                steps: 'Vai in Database Contratti → Nuovo Contratto → Seleziona fornitore → Compila dati → Salva.',
              },
              {
                num: 3, title: 'Invio Richiesta Vendor Rating',
                steps: 'Vai in Vendor Rating → Nuova Richiesta Valutazione → Seleziona fornitore → Inserisci email → Clicca "Crea Richiesta". Copia il link survey.',
              },
              {
                num: 4, title: 'Ricezione Email Valutazione',
                steps: 'Usa il pannello UAT (tab corrente) → Inserisci email → Clicca "Invia Email". Apri la casella pepe@tigem.it.',
              },
              {
                num: 5, title: 'Compilazione Rating (Survey)',
                steps: 'Apri il link survey ricevuto per email. Assegna le stelle ai 3 KPI. Clicca "Invia Valutazione".',
              },
              {
                num: 6, title: 'Aggiornamento Score Fornitore',
                steps: 'Vai in Vendor Rating → cerca il fornitore valutato → verifica che il semaforo e la media si siano aggiornati.',
              },
            ].map(scenario => (
              <div key={scenario.num} style={{
                padding: '12px 16px', borderRadius: 8,
                background: scenario.num % 2 === 0 ? '#f8faff' : '#fff',
                marginBottom: 8, border: '1px solid #f0f0f0',
              }}>
                <Space>
                  <Tag color="blue" style={{ minWidth: 28, textAlign: 'center' }}>
                    {scenario.num}
                  </Tag>
                  <Text strong>{scenario.title}</Text>
                </Space>
                <Text type="secondary" style={{ display: 'block', marginTop: 4, fontSize: 13, paddingLeft: 40 }}>
                  {scenario.steps}
                </Text>
              </div>
            ))}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

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
      key: 'uat',
      label: (
        <span>
          <SendOutlined /> UAT & Test
        </span>
      ),
      children: <UatTab />,
    },
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

      <Tabs items={tabItems} defaultActiveKey="uat" />
    </div>
  )
}

export default AdminPanel
