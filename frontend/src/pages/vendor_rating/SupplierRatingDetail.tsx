import React, { useState, useEffect } from 'react'
import {
  Card, Table, Tag, Typography, Space, Button, Rate, Form, Select,
  InputNumber, Input, message, Spin, Alert, Tabs, Statistic, Row, Col,
  Progress, Divider, Tooltip, Badge
} from 'antd'
import { ArrowLeftOutlined, StarOutlined, SaveOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { vendorRatingApi } from '../../services/api'
import type { RatingDetail, SupplierRatingSummary } from '../../types'
import { Semaforo } from '../../components/common/Semaforo'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const TRIGGER_LABELS: Record<string, string> = {
  ddt_beni: 'DDT Beni',
  ft_beni_osd: 'Fattura OSD',
  opr_completato: 'OPR Completato',
}

function StarDisplay({ value }: { value: number | null | undefined }) {
  if (!value) return <Text type="secondary">—</Text>
  return (
    <Tooltip title={`${value.toFixed(1)} / 5`}>
      <Rate disabled value={value} count={5} style={{ fontSize: 14 }} />
    </Tooltip>
  )
}

function KpiBar({ value, max = 5, label }: { value: number | null; max?: number; label?: string }) {
  if (!value) return <Text type="secondary">—</Text>
  const pct = Math.round((value / max) * 100)
  const color = value >= 4 ? '#52c41a' : value >= 2.5 ? '#faad14' : '#ff4d4f'
  return (
    <Tooltip title={label}>
      <Space>
        <Progress percent={pct} size="small" strokeColor={color} showInfo={false} style={{ width: 80 }} />
        <Text style={{ fontSize: 12 }}>{value.toFixed(1)}</Text>
      </Space>
    </Tooltip>
  )
}

export const SupplierRatingDetail: React.FC = () => {
  const { supplier_id } = useParams<{ supplier_id: string }>()
  const navigate = useNavigate()

  const [ratings, setRatings] = useState<RatingDetail[]>([])
  const [summary, setSummary] = useState<SupplierRatingSummary | null>(null)
  const [uaReviews, setUaReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [uaForm] = Form.useForm()
  const [savingUa, setSavingUa] = useState(false)

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, sRes, uaRes] = await Promise.all([
          vendorRatingApi.supplierRatings(Number(supplier_id)),
          vendorRatingApi.dashboard({ q: '', page_size: 999 }),
          vendorRatingApi.listUaReviews(Number(supplier_id)),
        ])
        setRatings(rRes.data)
        // Find this supplier in dashboard
        const found = sRes.data.items.find((s: SupplierRatingSummary) => s.supplier_id === Number(supplier_id))
        if (found) setSummary(found)
        setUaReviews(uaRes.data)
        // Pre-fill UA form for current year if exists
        const currentReview = uaRes.data.find((r: any) => r.anno === currentYear)
        if (currentReview) uaForm.setFieldsValue({ anno: currentYear, ...currentReview })
        else uaForm.setFieldValue('anno', currentYear)
      } catch (err) {
        message.error('Errore caricamento dati rating')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supplier_id])

  const saveUaReview = async (values: any) => {
    setSavingUa(true)
    try {
      await vendorRatingApi.createUaReview(Number(supplier_id), values)
      message.success('Valutazione UA salvata')
      // Refresh summary
      const sRes = await vendorRatingApi.dashboard({ page_size: 999 })
      const found = sRes.data.items.find((s: SupplierRatingSummary) => s.supplier_id === Number(supplier_id))
      if (found) setSummary(found)
    } catch {
      message.error('Errore nel salvataggio')
    } finally {
      setSavingUa(false)
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />

  const ratingColumns: ColumnsType<RatingDetail> = [
    {
      title: 'Semafor.',
      key: 'sem',
      width: 70,
      align: 'center',
      render: (_, r) => <Semaforo status={r.semaforo} size={16} />,
    },
    {
      title: 'Protocollo',
      dataIndex: 'protocollo_ordine',
      key: 'prot',
      width: 110,
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'Tipo',
      dataIndex: 'tipo_trigger',
      key: 'tipo',
      width: 120,
      render: (v) => v ? <Tag>{TRIGGER_LABELS[v] || v}</Tag> : '—',
    },
    {
      title: 'Data ordine',
      dataIndex: 'data_ordine',
      key: 'dord',
      width: 100,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
    {
      title: 'Data valut.',
      dataIndex: 'data_valutazione',
      key: 'dval',
      width: 110,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
    {
      title: 'Valutatore',
      dataIndex: 'valutatore_nome',
      key: 'val',
      width: 120,
      ellipsis: true,
    },
    {
      title: 'K1 Prezzo',
      dataIndex: 'kpi1_qualita_prezzo',
      key: 'k1',
      width: 110,
      render: (v) => <StarDisplay value={v} />,
    },
    {
      title: 'K2 Relaz.',
      dataIndex: 'kpi2_qualita_relazionale',
      key: 'k2',
      width: 110,
      render: (v) => <StarDisplay value={v} />,
    },
    {
      title: 'K3 Tecnica',
      dataIndex: 'kpi3_qualita_tecnica',
      key: 'k3',
      width: 110,
      render: (v) => <StarDisplay value={v} />,
    },
    {
      title: 'K4 Tempi',
      dataIndex: 'kpi4_affidabilita_tempi',
      key: 'k4',
      width: 110,
      render: (v) => <StarDisplay value={v} />,
    },
    {
      title: 'K5 Puntualità',
      dataIndex: 'kpi5_delta_giorni',
      key: 'k5',
      width: 110,
      render: (v, r) => {
        if (v === null || v === undefined) return '—'
        const label = v > 0 ? `+${v}gg anticipo` : v < 0 ? `${v}gg ritardo` : 'Puntuale'
        return <Tooltip title={label}><KpiBar value={r.kpi5_score} label={label} /></Tooltip>
      },
    },
    {
      title: 'K6 Prec. %',
      dataIndex: 'kpi6_precisione_pct',
      key: 'k6',
      width: 100,
      render: (v) => v !== null && v !== undefined ? `${v.toFixed(1)}%` : '—',
    },
    {
      title: 'K7 NC',
      dataIndex: 'kpi7_non_conformita',
      key: 'k7',
      width: 70,
      render: (v) => v > 0 ? <Tag color="red">{v}</Tag> : <Tag color="success">0</Tag>,
    },
    {
      title: 'Media',
      dataIndex: 'media_generale',
      key: 'media',
      width: 90,
      render: (v) => v !== null && v !== undefined
        ? <Text strong style={{ color: v >= 4 ? '#52c41a' : v >= 2.5 ? '#faad14' : '#ff4d4f' }}>{v.toFixed(2)}</Text>
        : '—',
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      render: (v) => v ? <Tooltip title={v}><Text style={{ maxWidth: 150, display: 'inline-block' }} ellipsis>{v}</Text></Tooltip> : '—',
    },
  ]

  const KPI_UA_LABELS = [
    { key: 'kpi1', name: 'kpi1_qualita_prezzo', label: 'Qualità prezzo/fornitura' },
    { key: 'kpi2', name: 'kpi2_qualita_relazionale', label: 'Qualità relazionale' },
    { key: 'kpi3', name: 'kpi3_qualita_tecnica', label: 'Qualità tecnica' },
    { key: 'kpi4', name: 'kpi4_affidabilita_tempi', label: 'Affidabilità tempi' },
    { key: 'kpi5', name: 'kpi5_gestione_nc', label: 'Gestione NC/reclami' },
    { key: 'kpi6', name: 'kpi6_innovazione', label: 'Innovazione e collaborazione' },
  ]

  const tabItems = [
    {
      key: 'ratings',
      label: `Valutazioni utenti (${ratings.length})`,
      children: (
        <Table
          columns={ratingColumns}
          dataSource={ratings}
          rowKey="id"
          size="small"
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} valutazioni` }}
        />
      ),
    },
    {
      key: 'ua',
      label: 'Valutazione Annuale UA',
      children: (
        <Row gutter={24}>
          <Col xs={24} md={14}>
            <Card title={`Valutazione UA ${currentYear}`}>
              <Form form={uaForm} layout="vertical" onFinish={saveUaReview}>
                <Form.Item name="anno" label="Anno" rules={[{ required: true }]}>
                  <Select>
                    {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                      <Option key={y} value={y}>{y}</Option>
                    ))}
                  </Select>
                </Form.Item>
                {KPI_UA_LABELS.map((kpi) => (
                  <Form.Item key={kpi.key} name={kpi.name} label={kpi.label}>
                    <Rate count={5} />
                  </Form.Item>
                ))}
                <Form.Item name="note" label="Note">
                  <TextArea rows={3} placeholder="Commenti e note per la valutazione annuale..." />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={savingUa} icon={<SaveOutlined />}>
                  Salva valutazione UA
                </Button>
              </Form>
            </Card>
          </Col>
          <Col xs={24} md={10}>
            <Card title="Storico valutazioni UA">
              <Table
                dataSource={uaReviews}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Anno', dataIndex: 'anno', key: 'anno' },
                  { title: 'Media UA', dataIndex: 'media_ua', key: 'media',
                    render: (v: number) => v ? <Text strong>{v.toFixed(2)}</Text> : '—' },
                  { title: 'Note', dataIndex: 'note', key: 'note', ellipsis: true,
                    render: (v: string) => v || '—' },
                ]}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/vendor-rating')}>
          Dashboard Vendor Rating
        </Button>
        {summary?.supplier_id && (
          <Button onClick={() => navigate(`/suppliers/${summary.supplier_id}`)}>
            Vai al fornitore in Albo
          </Button>
        )}
      </Space>

      {/* Summary card */}
      {summary && (
        <Card style={{ marginBottom: 16 }}>
          <Row align="middle" justify="space-between">
            <Col>
              <Space>
                <Semaforo status={summary.semaforo} size={28} />
                <div>
                  <Title level={4} style={{ margin: 0 }}>{summary.ragione_sociale}</Title>
                  <Text type="secondary">{summary.total_user_ratings} valutazioni utente</Text>
                </div>
              </Space>
            </Col>
            <Col>
              <Row gutter={24}>
                <Col>
                  <Statistic title="Media utenti" value={summary.media_utente?.toFixed(2) || '—'}
                    suffix="/ 5" valueStyle={{ color: '#1677ff' }} />
                </Col>
                <Col>
                  <Statistic title={`Media UA ${summary.anno_ua || '—'}`}
                    value={summary.media_ua?.toFixed(2) || '—'} suffix="/ 5"
                    valueStyle={{ color: '#722ed1' }} />
                </Col>
                <Col>
                  <Statistic title="Media Finale (70%+30%)"
                    value={summary.media_generale?.toFixed(2) || '—'} suffix="/ 5"
                    valueStyle={{
                      color: (summary.media_generale || 0) >= 4 ? '#52c41a'
                        : (summary.media_generale || 0) >= 2.5 ? '#faad14' : '#ff4d4f'
                    }} />
                </Col>
              </Row>
            </Col>
          </Row>

          <Divider />
          <Row gutter={16}>
            {[
              { label: 'Prezzo/Fornitura', value: summary.media_kpi1 },
              { label: 'Relazionale', value: summary.media_kpi2 },
              { label: 'Tecnica', value: summary.media_kpi3 },
              { label: 'Tempi', value: summary.media_kpi4 },
              { label: 'Puntualità', value: summary.media_kpi5_score },
              { label: 'Precisione', value: summary.media_kpi6_score },
            ].map((kpi, i) => (
              <Col key={i} xs={12} md={4}>
                <Text type="secondary" style={{ fontSize: 12 }}>{kpi.label}</Text>
                <div><KpiBar value={kpi.value} /></div>
              </Col>
            ))}
            <Col xs={12} md={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>NC medie</Text>
              <div>
                <Text>{summary.media_kpi7_nc !== null ? summary.media_kpi7_nc?.toFixed(1) : '—'}</Text>
              </div>
            </Col>
          </Row>
        </Card>
      )}

      <Tabs items={tabItems} />
    </div>
  )
}
