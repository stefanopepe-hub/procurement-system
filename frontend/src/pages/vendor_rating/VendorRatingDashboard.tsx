import React, { useState, useEffect } from 'react'
import {
  Table, Card, Row, Col, Typography, Tag, Space, Button, Input,
  Select, Statistic, message, Progress, Tooltip
} from 'antd'
import { SearchOutlined, DownloadOutlined, EyeOutlined, StarOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { vendorRatingApi } from '../../services/api'
import type { SupplierRatingSummary, SemaforoStatus } from '../../types'
import { Semaforo } from '../../components/common/Semaforo'

const { Title, Text } = Typography
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

export const VendorRatingDashboard: React.FC = () => {
  const navigate = useNavigate()
  const [summaries, setSummaries] = useState<SupplierRatingSummary[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)
  const [q, setQ] = useState('')
  const [semaforoFilter, setSemaforoFilter] = useState<SemaforoStatus | undefined>()

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
          <Button icon={<DownloadOutlined />} onClick={() => message.info('Export in Excel in sviluppo')}>
            Esporta Excel
          </Button>
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
    </div>
  )
}
