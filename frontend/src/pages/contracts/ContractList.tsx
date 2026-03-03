import React, { useState, useEffect } from 'react'
import {
  Table, Button, Input, Select, Space, Tag, Card, Row, Col,
  Typography, Tooltip, DatePicker, Badge, message, Checkbox
} from 'antd'
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { contractsApi } from '../../services/api'
import type { ContractListItem, ContractStatus, EnteStipulante } from '../../types'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

const STATUS_LABELS: Record<ContractStatus, string> = {
  attivo: 'Attivo',
  non_attivo: 'Non attivo',
  in_rinegoziazione: 'In rinegoziazione',
}
const STATUS_COLORS: Record<ContractStatus, string> = {
  attivo: 'green',
  non_attivo: 'default',
  in_rinegoziazione: 'blue',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return dayjs(dateStr).diff(dayjs(), 'day')
}

function ExpiryBadge({ date, label }: { date: string | null; label: string }) {
  if (!date) return <span>—</span>
  const days = daysUntil(date)
  const formatted = new Date(date).toLocaleDateString('it-IT')
  if (days !== null && days <= 0) return <Tag color="red"><WarningOutlined /> {formatted} (scaduto)</Tag>
  if (days !== null && days <= 30) return <Tag color="red">{formatted} ({days}gg)</Tag>
  if (days !== null && days <= 60) return <Tag color="orange">{formatted} ({days}gg)</Tag>
  return <span>{formatted}</span>
}

export const ContractList: React.FC = () => {
  const navigate = useNavigate()
  const [contracts, setContracts] = useState<ContractListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<ContractStatus[]>([])
  const [enteFilter, setEnteFilter] = useState<EnteStipulante | undefined>()
  const [cdcFilter, setCdcFilter] = useState('')
  const [scadRangeFilter, setScadRangeFilter] = useState<[string, string] | null>(null)
  const [dpaFilter, setDpaFilter] = useState<boolean | undefined>()
  const [gdprFilter, setGdprFilter] = useState<boolean | undefined>()
  const [dpiaFilter, setDpiaFilter] = useState<boolean | undefined>()

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (q) params.q = q
      if (statusFilter.length) params.status = statusFilter
      if (enteFilter) params.ente_stipulante = enteFilter
      if (cdcFilter) params.cdc = cdcFilter
      if (scadRangeFilter) {
        params.data_scadenza_from = scadRangeFilter[0]
        params.data_scadenza_to = scadRangeFilter[1]
      }
      if (dpaFilter !== undefined) params.dpa = dpaFilter
      if (gdprFilter !== undefined) params.questionario_it_gdpr = gdprFilter
      if (dpiaFilter !== undefined) params.dpia = dpiaFilter

      const res = await contractsApi.list(params)
      setContracts(res.data.items)
      setTotal(res.data.total)
    } catch {
      message.error('Errore nel caricamento contratti')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, q, statusFilter, enteFilter, cdcFilter, scadRangeFilter, dpaFilter, gdprFilter, dpiaFilter])

  const columns: ColumnsType<ContractListItem> = [
    {
      title: 'ID Contratto',
      dataIndex: 'id_contratto',
      key: 'id_contratto',
      width: 120,
      render: (v, r) => (
        <Button type="link" onClick={() => navigate(`/contracts/${r.id}`)} style={{ padding: 0, fontFamily: 'monospace' }}>
          {v}
        </Button>
      ),
    },
    {
      title: 'Fornitore',
      dataIndex: 'ragione_sociale',
      key: 'ragione_sociale',
      render: (v, r) => r.supplier_id
        ? <Button type="link" onClick={() => navigate(`/suppliers/${r.supplier_id}`)} style={{ padding: 0 }}>{v}</Button>
        : v,
    },
    {
      title: 'Stato',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (s: ContractStatus) => <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>,
    },
    {
      title: 'Ente',
      dataIndex: 'ente_stipulante',
      key: 'ente',
      width: 100,
      render: (v) => v ? <Tag>{v}</Tag> : '—',
    },
    {
      title: 'CDC',
      dataIndex: 'cdc',
      key: 'cdc',
      width: 100,
      render: (v) => v || '—',
    },
    {
      title: 'Oggetto',
      dataIndex: 'oggetto',
      key: 'oggetto',
      ellipsis: true,
    },
    {
      title: 'Ivato (€)',
      dataIndex: 'ivato',
      key: 'ivato',
      width: 120,
      render: (v) => v ? Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '—',
    },
    {
      title: 'Scadenza',
      dataIndex: 'data_scadenza',
      key: 'data_scadenza',
      width: 150,
      render: (v) => <ExpiryBadge date={v} label="Scadenza" />,
    },
    {
      title: 'Rinegoziazione',
      dataIndex: 'data_rinegoziazione',
      key: 'data_rinegoziazione',
      width: 150,
      render: (v) => <ExpiryBadge date={v} label="Rinegoziazione" />,
    },
    {
      title: 'DPA/GDPR/DPIA',
      key: 'privacy',
      width: 120,
      render: (_, r) => (
        <Space size={2}>
          {r.dpa && <Tag color="purple" style={{ fontSize: 10 }}>DPA</Tag>}
          {r.questionario_it_gdpr && <Tag color="blue" style={{ fontSize: 10 }}>GDPR</Tag>}
          {r.dpia && <Tag color="cyan" style={{ fontSize: 10 }}>DPIA</Tag>}
        </Space>
      ),
    },
    {
      title: 'Alert',
      dataIndex: 'alert_enabled',
      key: 'alert',
      width: 70,
      render: (v) => v
        ? <Tag color="success">ON</Tag>
        : <Tag color="default">OFF</Tag>,
    },
    {
      title: 'Azioni',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="Visualizza"><Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/contracts/${r.id}`)} /></Tooltip>
          <Tooltip title="Modifica"><Button icon={<EditOutlined />} size="small" onClick={() => navigate(`/contracts/${r.id}/edit`)} /></Tooltip>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Database Contratti</Title>
          <small style={{ color: '#888' }}>{total} contratti</small>
        </Col>
        <Col>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/contracts/new')}>
            Nuovo Contratto
          </Button>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input prefix={<SearchOutlined />} placeholder="Cerca fornitore, oggetto, ID, CDC..."
              value={q} onChange={(e) => { setQ(e.target.value); setPage(1) }} allowClear />
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select mode="multiple" placeholder="Stato contratto" style={{ width: '100%' }}
              value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} allowClear>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <Option key={k} value={k}>{v}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Select placeholder="Ente stipulante" style={{ width: '100%' }}
              value={enteFilter} onChange={(v) => { setEnteFilter(v); setPage(1) }} allowClear>
              <Option value="struttura">Struttura</Option>
              <Option value="ricerca">Ricerca</Option>
              <Option value="entrambi">Entrambi</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4}>
            <Input placeholder="CDC" value={cdcFilter}
              onChange={(e) => { setCdcFilter(e.target.value); setPage(1) }} allowClear />
          </Col>
          <Col xs={24} sm={12} md={3}>
            <Space>
              <Tooltip title="DPA"><Checkbox onChange={(e) => setDpaFilter(e.target.checked ? true : undefined)}>DPA</Checkbox></Tooltip>
              <Tooltip title="IT GDPR"><Checkbox onChange={(e) => setGdprFilter(e.target.checked ? true : undefined)}>GDPR</Checkbox></Tooltip>
              <Tooltip title="DPIA"><Checkbox onChange={(e) => setDpiaFilter(e.target.checked ? true : undefined)}>DPIA</Checkbox></Tooltip>
            </Space>
          </Col>
          <Col xs={24} md={12}>
            <Space>
              <span style={{ fontSize: 12, color: '#888' }}>Scadenza:</span>
              <RangePicker size="small"
                onChange={(dates) => {
                  if (dates?.[0] && dates?.[1]) {
                    setScadRangeFilter([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
                  } else {
                    setScadRangeFilter(null)
                  }
                }} />
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={contracts}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1500 }}
        rowClassName={(r) => {
          const d = daysUntil(r.data_scadenza)
          if (d !== null && d <= 30) return 'row-danger'
          if (d !== null && d <= 60) return 'row-warning'
          return ''
        }}
        pagination={{ current: page, pageSize, total, showTotal: (t) => `${t} contratti`, onChange: setPage }}
      />
    </div>
  )
}
