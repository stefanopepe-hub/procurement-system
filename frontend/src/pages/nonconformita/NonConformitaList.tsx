import React, { useState, useEffect } from 'react'
import {
  Table, Button, Select, Space, Tag, Card, Row, Col,
  Typography, Tooltip, DatePicker, message, Empty
} from 'antd'
import { SearchOutlined, WarningOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import dayjs from 'dayjs'
import { nonConformitaApi, suppliersApi } from '../../services/api'

const { Title } = Typography
const { Option } = Select
const { RangePicker } = DatePicker

interface NcItem {
  id: number
  nc_id_esterno: string
  supplier_id: number | null
  ragione_sociale: string | null
  numero_ordine: string | null
  descrizione: string | null
  data_apertura: string | null
  data_chiusura: string | null
  stato: string | null
  gravita: string | null
  created_at: string | null
}

interface SupplierOption {
  id: number
  ragione_sociale: string
}

const STATO_COLOR: Record<string, string> = {
  aperta: 'red',
  in_lavorazione: 'orange',
  chiusa: 'green',
}

const STATO_LABEL: Record<string, string> = {
  aperta: 'Aperta',
  in_lavorazione: 'In lavorazione',
  chiusa: 'Chiusa',
}

const GRAVITA_COLOR: Record<string, string> = {
  lieve: 'blue',
  media: 'orange',
  grave: 'red',
}

export const NonConformitaList: React.FC = () => {
  const navigate = useNavigate()
  const [items, setItems] = useState<NcItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  const [supplierFilter, setSupplierFilter] = useState<number | undefined>()
  const [statoFilter, setStatoFilter] = useState<string | undefined>()
  const [dateRange, setDateRange] = useState<[string, string] | null>(null)
  const [supplierOptions, setSupplierOptions] = useState<SupplierOption[]>([])

  // Load supplier list for the filter dropdown
  useEffect(() => {
    suppliersApi.list({ page: 1, page_size: 500 })
      .then((res) => {
        setSupplierOptions(res.data.items || [])
      })
      .catch(() => {})
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: pageSize }
      if (supplierFilter) params.supplier_id = supplierFilter
      if (statoFilter) params.stato = statoFilter
      const res = await nonConformitaApi.list(params)
      let data = res.data.items || []

      // Client-side date range filter (data_apertura)
      if (dateRange) {
        const [from, to] = dateRange
        data = data.filter((nc: NcItem) => {
          if (!nc.data_apertura) return false
          return nc.data_apertura >= from && nc.data_apertura <= to
        })
      }

      setItems(data)
      setTotal(res.data.total)
    } catch {
      message.error('Errore nel caricamento delle non conformità')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, supplierFilter, statoFilter, dateRange])

  const columns: ColumnsType<NcItem> = [
    {
      title: 'ID Ordine',
      dataIndex: 'numero_ordine',
      key: 'numero_ordine',
      width: 140,
      render: (v) => v ? <span style={{ fontFamily: 'monospace' }}>{v}</span> : '—',
    },
    {
      title: 'NC Esterno',
      dataIndex: 'nc_id_esterno',
      key: 'nc_id_esterno',
      width: 120,
      render: (v) => <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#888' }}>{v}</span>,
    },
    {
      title: 'Fornitore',
      dataIndex: 'ragione_sociale',
      key: 'ragione_sociale',
      render: (v, r) => r.supplier_id
        ? (
          <Button
            type="link"
            onClick={() => navigate(`/suppliers/${r.supplier_id}`)}
            style={{ padding: 0 }}
          >
            {v || '—'}
          </Button>
        )
        : (v || '—'),
    },
    {
      title: 'Descrizione',
      dataIndex: 'descrizione',
      key: 'descrizione',
      ellipsis: true,
      render: (v) => v
        ? <Tooltip title={v}>{v.length > 80 ? v.slice(0, 80) + '…' : v}</Tooltip>
        : '—',
    },
    {
      title: 'Stato',
      dataIndex: 'stato',
      key: 'stato',
      width: 140,
      render: (v: string) => v
        ? (
          <Tag color={STATO_COLOR[v] || 'default'} icon={v === 'aperta' ? <WarningOutlined /> : undefined}>
            {STATO_LABEL[v] || v}
          </Tag>
        )
        : '—',
    },
    {
      title: 'Gravità',
      dataIndex: 'gravita',
      key: 'gravita',
      width: 100,
      render: (v: string) => v
        ? <Tag color={GRAVITA_COLOR[v] || 'default'}>{v.charAt(0).toUpperCase() + v.slice(1)}</Tag>
        : '—',
    },
    {
      title: 'Data Segnalazione',
      dataIndex: 'data_apertura',
      key: 'data_apertura',
      width: 150,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
    {
      title: 'Data Chiusura',
      dataIndex: 'data_chiusura',
      key: 'data_chiusura',
      width: 130,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <WarningOutlined style={{ marginRight: 8, color: '#faad14' }} />
            Non Conformità
          </Title>
          <small style={{ color: '#888' }}>{total} non conformità registrate</small>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Select
              showSearch
              placeholder="Filtra per fornitore"
              style={{ width: '100%' }}
              value={supplierFilter}
              onChange={(v) => { setSupplierFilter(v); setPage(1) }}
              allowClear
              filterOption={(input, option) =>
                String(option?.children ?? '').toLowerCase().includes(input.toLowerCase())
              }
            >
              {supplierOptions.map((s) => (
                <Option key={s.id} value={s.id}>{s.ragione_sociale}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={8} md={5}>
            <Select
              placeholder="Filtra per stato"
              style={{ width: '100%' }}
              value={statoFilter}
              onChange={(v) => { setStatoFilter(v); setPage(1) }}
              allowClear
            >
              <Option value="aperta">Aperta</Option>
              <Option value="in_lavorazione">In lavorazione</Option>
              <Option value="chiusa">Chiusa</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space>
              <SearchOutlined style={{ color: '#888' }} />
              <span style={{ fontSize: 12, color: '#888' }}>Data segnalazione:</span>
              <RangePicker
                size="small"
                onChange={(dates) => {
                  if (dates?.[0] && dates?.[1]) {
                    setDateRange([
                      dates[0].format('YYYY-MM-DD'),
                      dates[1].format('YYYY-MM-DD'),
                    ])
                  } else {
                    setDateRange(null)
                  }
                  setPage(1)
                }}
              />
            </Space>
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={items}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1100 }}
        locale={{
          emptyText: (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Nessuna non conformità registrata"
            />
          ),
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `${t} non conformità`,
          onChange: setPage,
        }}
      />
    </div>
  )
}
