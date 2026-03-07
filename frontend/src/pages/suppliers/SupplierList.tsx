import React, { useState, useEffect } from 'react'
import {
  Table, Button, Input, Select, Space, Tag, Card, Row, Col,
  Typography, Tooltip, Badge, Dropdown, message
} from 'antd'
import {
  PlusOutlined, SearchOutlined, FilterOutlined, ExportOutlined,
  EyeOutlined, EditOutlined, DownloadOutlined
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { ColumnsType } from 'antd/es/table'
import { suppliersApi } from '../../services/api'
import type { SupplierListItem, SupplierStatus, AccreditamentType } from '../../types'
import { Semaforo } from '../../components/common/Semaforo'
import { useAuthStore, isAdmin } from '../../store/auth'

const { Title } = Typography
const { Option } = Select

const STATUS_LABELS: Record<SupplierStatus, string> = {
  accreditato: 'Accreditato',
  non_piu_accreditato: 'Non più accreditato',
  sotto_osservazione: 'Sotto osservazione',
  in_riqualifica: 'In riqualifica',
}
const STATUS_COLORS: Record<SupplierStatus, string> = {
  accreditato: 'green',
  non_piu_accreditato: 'red',
  sotto_osservazione: 'orange',
  in_riqualifica: 'blue',
}

export const SupplierList: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const admin = isAdmin(user)

  const [suppliers, setSuppliers] = useState<SupplierListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  // Filters
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState<SupplierStatus[]>([])
  const [accreditamentFilter, setAccreditamentFilter] = useState<AccreditamentType | undefined>()
  const [categoriaFilter, setCategoriaFilter] = useState('')

  const handleExportCSV = async () => {
    try {
      const response = await suppliersApi.exportCsv()
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', 'fornitori.csv')
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      message.error('Errore durante l\'export CSV dei fornitori')
    }
  }

  const load = async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, page_size: pageSize }
      if (q) params.q = q
      if (statusFilter.length) params.status = statusFilter
      if (accreditamentFilter) params.accreditament_type = accreditamentFilter
      if (categoriaFilter) params.categoria_merceologica = categoriaFilter

      const res = await suppliersApi.list(params)
      setSuppliers(res.data.items)
      setTotal(res.data.total)
    } catch {
      message.error('Errore nel caricamento fornitori')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, q, statusFilter, accreditamentFilter, categoriaFilter])

  const columns: ColumnsType<SupplierListItem> = [
    {
      title: 'Semaforo',
      key: 'semaforo',
      width: 80,
      align: 'center',
      render: (_, r) => <Semaforo status={r.semaforo} size={18} />,
    },
    {
      title: 'Ragione Sociale',
      dataIndex: 'ragione_sociale',
      key: 'ragione_sociale',
      sorter: true,
      render: (text, r) => (
        <Button type="link" onClick={() => navigate(`/suppliers/${r.id}`)} style={{ padding: 0 }}>
          {text}
        </Button>
      ),
    },
    {
      title: 'Cod. Fornitore',
      dataIndex: 'alyante_code',
      key: 'alyante_code',
      width: 120,
      render: (v) => v || '—',
    },
    {
      title: 'P.IVA',
      dataIndex: 'partita_iva',
      key: 'partita_iva',
      width: 130,
      render: (v) => v || '—',
    },
    {
      title: 'Stato',
      dataIndex: 'status',
      key: 'status',
      width: 170,
      render: (s: SupplierStatus) => (
        <Tag color={STATUS_COLORS[s]}>{STATUS_LABELS[s]}</Tag>
      ),
    },
    {
      title: 'Tipo',
      dataIndex: 'accreditament_type',
      key: 'accreditament_type',
      width: 120,
      render: (v) => v ? <Tag>{v === 'strategico' ? 'Strategico' : 'Preferenziale'}</Tag> : '—',
    },
    {
      title: 'Settore',
      dataIndex: 'settore_attivita',
      key: 'settore_attivita',
      ellipsis: true,
      render: (v) => v || '—',
    },
    {
      title: 'Iscrizione',
      dataIndex: 'data_iscrizione',
      key: 'data_iscrizione',
      width: 110,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
    {
      title: 'Riqualifica',
      dataIndex: 'data_riqualifica',
      key: 'data_riqualifica',
      width: 110,
      render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—',
    },
    {
      title: 'Azioni',
      key: 'actions',
      width: 90,
      fixed: 'right',
      render: (_, r) => (
        <Space>
          <Tooltip title="Visualizza">
            <Button icon={<EyeOutlined />} size="small" onClick={() => navigate(`/suppliers/${r.id}`)} />
          </Tooltip>
          {admin && (
            <Tooltip title="Modifica">
              <Button icon={<EditOutlined />} size="small" onClick={() => navigate(`/suppliers/${r.id}/edit`)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>Albo Fornitori</Title>
          <small style={{ color: '#888' }}>{total} fornitori registrati</small>
        </Col>
        {admin && (
          <Col>
            <Space>
              <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>
                Export CSV
              </Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/suppliers/new')}>
                Nuovo Fornitore
              </Button>
            </Space>
          </Col>
        )}
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} md={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Cerca per ragione sociale, P.IVA, codice..."
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select
              mode="multiple"
              placeholder="Filtra per stato"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              allowClear
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <Option key={k} value={k}>{v}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Select
              placeholder="Tipo accreditamento"
              style={{ width: '100%' }}
              value={accreditamentFilter}
              onChange={(v) => { setAccreditamentFilter(v); setPage(1) }}
              allowClear
            >
              <Option value="strategico">Strategico</Option>
              <Option value="preferenziale">Preferenziale</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={5}>
            <Input
              placeholder="Categoria merceologica"
              value={categoriaFilter}
              onChange={(e) => { setCategoriaFilter(e.target.value); setPage(1) }}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Table
        columns={columns}
        dataSource={suppliers}
        rowKey="id"
        loading={loading}
        scroll={{ x: 1200 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `${t} fornitori`,
          onChange: setPage,
        }}
      />
    </div>
  )
}
