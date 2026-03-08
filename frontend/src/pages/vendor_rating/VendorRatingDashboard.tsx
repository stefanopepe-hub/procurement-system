import React, { useState, useEffect } from 'react'
import {
  Table, Card, Row, Col, Typography, Tag, Space, Button, Input,
  Select, Statistic, message, Progress, Tooltip, Modal, Form,
  DatePicker, Alert, Divider,
} from 'antd'
import {
  SearchOutlined, DownloadOutlined, EyeOutlined, StarOutlined,
  PlusOutlined, SendOutlined, CopyOutlined, LinkOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { vendorRatingApi, suppliersApi } from '../../services/api'
import type { SupplierRatingSummary, SemaforoStatus } from '../../types'
import { Semaforo } from '../../components/common/Semaforo'

const { Title, Text, Paragraph } = Typography
const { Option } = Select

function KpiBar({ value, max = 5 }: { value: number | null; max?: number }) {
  if (value === null || value === undefined) return <Text type="secondary">—</Text>
  const pct = Math.round((value / max) * 100)
  const color = value >= 4 ? '#52c41a' : value >= 2.5 ? '#faad14' : '#ff4d4f'
  return (
    <Tooltip title={`${value.toFixed(2)} / ${max}`}>
      <Progress percent={pct} size="small" strokeColor={color} showInfo={false} style={{ width: 80 }} />
    </Tooltip>
  )
}

interface SupplierOption {
  id: number
  ragione_sociale: string
}

export const VendorRatingDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [summaries, setSummaries] = useState<SupplierRatingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [q, setQ] = useState('')
  const [semaforoFilter, setSemaforoFilter] = useState<SemaforoStatus | undefined>()

  // Modal "Nuova Richiesta"
  const [modalOpen, setModalOpen] = useState(false)
  const [modalLoading, setModalLoading] = useState(false)
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([])
  const [surveyResult, setSurveyResult] = useState<{
    survey_url: string
    email_sent: boolean
    email_to: string
  } | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (q) params.q = q
      if (semaforoFilter) params.semaforo = semaforoFilter
      const res = await vendorRatingApi.dashboard(params)
      setSummaries(res.data.items)
      setTotal(res.data.total)
    } catch {
      message.error('Errore nel caricamento vendor rating')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, q, semaforoFilter])

  const loadSuppliers = async () => {
    try {
      const res = await suppliersApi.list({ page: 1, page_size: 100, status: ['accreditato'] })
      setSuppliers((res.data?.items ?? []).map((s: any) => ({ id: s.id, ragione_sociale: s.ragione_sociale })))
    } catch {
      message.error('Errore nel caricamento fornitori')
    }
  }

  const openModal = () => {
    setSurveyResult(null)
    form.resetFields()
    form.setFieldsValue({ valutatore_email: 'pepe@tigem.it' })
    loadSuppliers()
    setModalOpen(true)
  }

  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields()
      setModalLoading(true)
      const res = await vendorRatingApi.createRequest({
        supplier_id: values.supplier_id,
        protocollo_ordine: values.protocollo_ordine || null,
        tipo_trigger: values.tipo_trigger,
        data_ordine: values.data_ordine ? values.data_ordine.format('YYYY-MM-DD') : null,
        valutatore_email: values.valutatore_email,
        valutatore_nome: values.valutatore_nome || null,
      })
      setSurveyResult({
        survey_url: res.data.survey_url,
        email_sent: res.data.email_sent,
        email_to: values.valutatore_email,
      })
      load() // refresh dashboard
    } catch (err: any) {
      if (err?.errorFields) return // validation error — antd handles it
      message.error('Errore nella creazione della richiesta')
    } finally {
      setModalLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => message.success('Link copiato!')).catch(() => {
      message.info('Copia manuale: ' + text)
    })
  }

  // KPI stats summary
  const verde = summaries.filter(s => s.semaforo === 'verde').length
  const giallo = summaries.filter(s => s.semaforo === 'giallo').length
  const rosso = summaries.filter(s => s.semaforo === 'rosso').length

  const columns: ColumnsType<SupplierRatingSummary> = [
    {
      title: 'Semaforo',
      key: 'semaforo',
      width: 90,
      align: 'center',
      render: (_, r) => <Semaforo status={r.semaforo} size={20} />,
      filters: [
        { text: 'Verde', value: 'verde' },
        { text: 'Giallo', value: 'giallo' },
        { text: 'Rosso', value: 'rosso' },
        { text: 'Grigio', value: 'grigio' },
      ],
    },
    {
      title: 'Fornitore',
      dataIndex: 'ragione_sociale',
      key: 'ragione_sociale',
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/vendor-rating/supplier/${r.supplier_id}`)} style={{ padding: 0 }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Valutazioni',
      dataIndex: 'total_ratings',
      key: 'total_ratings',
      width: 100,
      align: 'center',
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Media Generale',
      dataIndex: 'media_generale',
      key: 'media',
      width: 140,
      render: (v) => v !== null
        ? <Space><KpiBar value={v} /><Text strong>{v?.toFixed(2)}</Text></Space>
        : <Text type="secondary">—</Text>,
    },
    {
      title: '⭐ KPI 1 – Qualità fornitura',
      dataIndex: 'media_kpi1',
      key: 'kpi1',
      width: 160,
      render: (v) => <KpiBar value={v} />,
    },
    {
      title: '⏱ KPI 2 – Tempistiche',
      dataIndex: 'media_kpi2',
      key: 'kpi2',
      width: 150,
      render: (v) => <KpiBar value={v} />,
    },
    {
      title: '💬 KPI 3 – Comunicazione',
      dataIndex: 'media_kpi3',
      key: 'kpi3',
      width: 160,
      render: (v) => <KpiBar value={v} />,
    },
    {
      title: 'Azioni',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, r) => (
        <Tooltip title="Dettaglio valutazioni">
          <Button icon={<EyeOutlined />} size="small"
            onClick={() => navigate(`/vendor-rating/supplier/${r.supplier_id}`)} />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <StarOutlined style={{ marginRight: 8 }} />Vendor Rating – Dashboard
          </Title>
          <Text type="secondary">Media delle medie per fornitore valutato</Text>
        </Col>
        <Col>
          <Space>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={openModal}
              style={{ background: '#1a3a5c', borderColor: '#1a3a5c' }}
            >
              Nuova Richiesta Valutazione
            </Button>
            <Button icon={<DownloadOutlined />} onClick={() => message.info('Export in Excel in sviluppo')}>
              Esporta Excel
            </Button>
          </Space>
        </Col>
      </Row>

      {/* KPI overview */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={6}>
          <Card><Statistic title="Fornitori valutati" value={total} /></Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Semaforo Verde" value={verde}
              valueStyle={{ color: '#52c41a' }} prefix="●" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Semaforo Giallo" value={giallo}
              valueStyle={{ color: '#faad14' }} prefix="●" />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Semaforo Rosso" value={rosso}
              valueStyle={{ color: '#ff4d4f' }} prefix="●" />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} md={12}>
            <Input prefix={<SearchOutlined />} placeholder="Cerca fornitore..."
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} allowClear />
          </Col>
          <Col xs={24} md={6}>
            <Select placeholder="Filtra per semaforo" style={{ width: '100%' }}
              value={semaforoFilter} onChange={(v) => { setSemaforoFilter(v); setPage(1) }} allowClear>
              <Option value="verde">🟢 Verde</Option>
              <Option value="giallo">🟡 Giallo</Option>
              <Option value="rosso">🔴 Rosso</Option>
              <Option value="grigio">⚪ Grigio</Option>
            </Select>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={summaries}
        rowKey="supplier_id"
        loading={loading}
        scroll={{ x: 1300 }}
        pagination={{ current: page, pageSize, total, showTotal: (t) => `${t} fornitori valutati`, onChange: setPage }}
      />

      {/* Modal Nuova Richiesta Valutazione */}
      <Modal
        title={
          <Space>
            <SendOutlined style={{ color: '#1a3a5c' }} />
            <span>Nuova Richiesta di Valutazione</span>
          </Space>
        }
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setSurveyResult(null) }}
        footer={surveyResult ? (
          <Button type="primary" onClick={() => { setModalOpen(false); setSurveyResult(null) }}
            style={{ background: '#389e0d', borderColor: '#389e0d' }}>
            Chiudi
          </Button>
        ) : (
          <Space>
            <Button onClick={() => setModalOpen(false)}>Annulla</Button>
            <Button type="primary" loading={modalLoading} onClick={handleModalSubmit}
              icon={<SendOutlined />} style={{ background: '#1a3a5c', borderColor: '#1a3a5c' }}>
              Crea Richiesta e Invia Email
            </Button>
          </Space>
        )}
        width={580}
      >
        {surveyResult ? (
          <div style={{ padding: '8px 0' }}>
            <Alert
              type={surveyResult.email_sent ? 'success' : 'warning'}
              showIcon
              message={surveyResult.email_sent
                ? `Email inviata a ${surveyResult.email_to}`
                : 'SMTP non configurato — usa il link direttamente'}
              style={{ marginBottom: 20, borderRadius: 8 }}
            />
            <div style={{
              background: '#f8faff', borderRadius: 10, padding: '16px 20px',
              border: '1px solid #d6e4ff',
            }}>
              <Text strong style={{ fontSize: 13, display: 'block', marginBottom: 8 }}>
                <LinkOutlined style={{ marginRight: 6 }} />Link survey valutazione:
              </Text>
              <div style={{
                background: '#fff', border: '1px solid #d9d9d9', borderRadius: 6,
                padding: '8px 12px', wordBreak: 'break-all', fontSize: 13,
                fontFamily: 'monospace', marginBottom: 12,
              }}>
                {surveyResult.survey_url}
              </div>
              <Button
                type="primary" icon={<CopyOutlined />}
                onClick={() => copyToClipboard(surveyResult.survey_url)}
                style={{ background: '#1a3a5c', borderColor: '#1a3a5c' }}
                block
              >
                Copia Link Survey
              </Button>
            </div>
            <Divider />
            <Paragraph type="secondary" style={{ fontSize: 12, textAlign: 'center', margin: 0 }}>
              Il link è valido per 30 giorni. Il destinatario può compilare la valutazione senza login.
            </Paragraph>
          </div>
        ) : (
          <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
            <Form.Item
              name="supplier_id"
              label="Fornitore"
              rules={[{ required: true, message: 'Seleziona un fornitore' }]}
            >
              <Select
                showSearch
                placeholder="Seleziona fornitore..."
                filterOption={(input, option) =>
                  String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
                }
              >
                {suppliers.map(s => (
                  <Option key={s.id} value={s.id}>{s.ragione_sociale}</Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="tipo_trigger"
              label="Tipo evento"
              rules={[{ required: true, message: 'Seleziona il tipo di evento' }]}
              initialValue="opr_completato"
            >
              <Select>
                <Option value="opr_completato">Completamento ordine (OPR)</Option>
                <Option value="ddt_beni">Registrazione DDT beni</Option>
                <Option value="ft_beni_osd">Registrazione fattura</Option>
              </Select>
            </Form.Item>

            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item name="protocollo_ordine" label="Rif. Ordine / Protocollo">
                  <Input placeholder="es. ORD-2026-001" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="data_ordine" label="Data ordine">
                  <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
                </Form.Item>
              </Col>
            </Row>

            <Divider style={{ margin: '4px 0 12px' }}>Destinatario valutazione</Divider>

            <Row gutter={12}>
              <Col xs={24} sm={14}>
                <Form.Item
                  name="valutatore_email"
                  label="Email valutatore"
                  rules={[
                    { required: true, message: 'Inserire email' },
                    { type: 'email', message: 'Email non valida' },
                  ]}
                >
                  <Input placeholder="es. pepe@tigem.it" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={10}>
                <Form.Item name="valutatore_nome" label="Nome valutatore">
                  <Input placeholder="es. Giuseppe Pepe" />
                </Form.Item>
              </Col>
            </Row>

            <Alert
              type="info"
              showIcon
              message="Il sistema creerà un link survey sicuro e invierà l'email al destinatario (se SMTP configurato). Il link può essere copiato e inviato manualmente."
              style={{ borderRadius: 8 }}
            />
          </Form>
        )}
      </Modal>
    </div>
  )
}
