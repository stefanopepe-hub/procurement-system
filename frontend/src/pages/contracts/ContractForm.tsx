import React, { useState, useEffect } from 'react'
import {
  Form, Input, Select, DatePicker, Button, Card, Row, Col, Typography,
  Space, Switch, InputNumber, Divider, Table, Checkbox, Tag, message,
  Modal, Tooltip
} from 'antd'
import {
  ArrowLeftOutlined, SaveOutlined, PlusOutlined, LinkOutlined, DeleteOutlined
} from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { contractsApi, suppliersApi } from '../../services/api'
import api from '../../services/api'
import type { ContractDetail } from '../../types'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

export const ContractForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  // Order association
  const [linkedOrders, setLinkedOrders] = useState<any[]>([])
  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [orderModalOpen, setOrderModalOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<number | undefined>()

  // Supplier search
  const [supplierOptions, setSupplierOptions] = useState<{ value: number; label: string }[]>([])

  useEffect(() => {
    if (isEdit) {
      setLoading(true)
      contractsApi.get(Number(id)).then((res) => {
        const c: ContractDetail = res.data
        form.setFieldsValue({
          ...c,
          data_inizio: c.data_inizio ? dayjs(c.data_inizio) : undefined,
          data_scadenza: c.data_scadenza ? dayjs(c.data_scadenza) : undefined,
          data_rinegoziazione: c.data_rinegoziazione ? dayjs(c.data_rinegoziazione) : undefined,
        })
        if (c.supplier_id) setSelectedSupplierId(c.supplier_id)
        // Load linked orders
        api.get(`/contracts/${id}/orders`).then(r => setLinkedOrders(r.data)).catch(() => {})
      }).finally(() => setLoading(false))
    }
  }, [id])

  const searchSuppliers = async (q: string) => {
    if (!q) return
    const res = await suppliersApi.list({ q, page_size: 20 })
    setSupplierOptions(res.data.items.map((s: any) => ({
      value: s.id,
      label: `${s.ragione_sociale} (${s.alyante_code || s.partita_iva || '—'})`,
    })))
  }

  const loadAvailableOrders = async (supplierId: number) => {
    const res = await api.get(`/contracts/supplier/${supplierId}/available-orders`)
    setAvailableOrders(res.data)
    setOrderModalOpen(true)
  }

  const associateOrder = async (order: any) => {
    if (!id) return
    await api.post(`/contracts/${id}/orders`, order)
    const res = await api.get(`/contracts/${id}/orders`)
    setLinkedOrders(res.data)
    setAvailableOrders(availableOrders.filter(o => o.alyante_order_id !== order.alyante_order_id))
    message.success('Ordine associato')
  }

  const disassociateOrder = async (orderId: number) => {
    if (!id) return
    await api.delete(`/contracts/${id}/orders/${orderId}`)
    setLinkedOrders(linkedOrders.filter(o => o.id !== orderId))
    message.success('Associazione rimossa')
  }

  const onFinish = async (values: any) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        data_inizio: values.data_inizio?.format('YYYY-MM-DD'),
        data_scadenza: values.data_scadenza?.format('YYYY-MM-DD'),
        data_rinegoziazione: values.data_rinegoziazione?.format('YYYY-MM-DD'),
      }
      let contractId = Number(id)
      if (isEdit) {
        await contractsApi.update(contractId, payload)
        message.success('Contratto aggiornato')
      } else {
        const res = await contractsApi.create(payload)
        contractId = res.data.id
        message.success('Contratto creato')
      }
      navigate(`/contracts/${contractId}`)
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const watchImponibile = Form.useWatch('imponibile', form)
  const watchIva = Form.useWatch('iva_percentuale', form)
  useEffect(() => {
    if (watchImponibile && watchIva) {
      form.setFieldValue('ivato', Number((watchImponibile * (1 + watchIva / 100)).toFixed(2)))
    }
  }, [watchImponibile, watchIva])

  const orderColumns = [
    { title: 'Protocollo', dataIndex: 'protocollo', key: 'prot' },
    { title: 'Tipo', dataIndex: 'tipo_documento', key: 'tipo', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Oggetto', dataIndex: 'oggetto', key: 'ogg', ellipsis: true },
    { title: 'Data', dataIndex: 'data_ordine', key: 'data', render: (v: string) => v ? new Date(v).toLocaleDateString('it-IT') : '—' },
    { title: 'Importo €', dataIndex: 'importo', key: 'imp', render: (v: number) => v?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '—' },
    { title: 'Stato', dataIndex: 'stato', key: 'stato', render: (v: string) => <Tag>{v}</Tag> },
    ...(isEdit ? [{
      title: '',
      key: 'action',
      render: (_: any, r: any) => (
        <Button icon={<DeleteOutlined />} size="small" danger type="text"
          onClick={() => disassociateOrder(r.id)} />
      ),
    }] : []),
  ]

  const availableOrderColumns = [
    { title: 'Protocollo', dataIndex: 'protocollo', key: 'prot' },
    { title: 'Tipo', dataIndex: 'tipo_documento', key: 'tipo', render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Oggetto', dataIndex: 'oggetto', key: 'ogg', ellipsis: true },
    { title: 'Importo €', dataIndex: 'importo', key: 'imp', render: (v: number) => v?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '—' },
    { title: 'Stato', dataIndex: 'stato', key: 'stato', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: 'Associa',
      key: 'link',
      render: (_: any, r: any) => (
        <Button icon={<LinkOutlined />} size="small" type="primary" ghost
          onClick={() => associateOrder(r)}>Associa</Button>
      ),
    },
  ]

  return (
    <div>
      {/* Barra azioni sticky in cima */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', padding: '12px 0 12px',
        borderBottom: '1px solid #f0f0f0', marginBottom: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/contracts/${id}` : '/contracts')}>
            {isEdit ? 'Torna al contratto' : 'Database Contratti'}
          </Button>
          <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Modifica Contratto' : 'Nuovo Contratto'}</Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} size="large" loading={saving}
          onClick={() => form.submit()}>
          {isEdit ? 'Salva Modifiche' : 'Crea Contratto'}
        </Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>

        {/* ── Fornitore ── */}
        <Card title="Fornitore" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ragione_sociale" label="Ragione Sociale" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="codice_fornitore" label="Codice Fornitore">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="supplier_id" label="Collega ad Albo Fornitori (opzionale)">
                <Select
                  showSearch allowClear
                  placeholder="Cerca fornitore in albo..."
                  filterOption={false}
                  onSearch={searchSuppliers}
                  onChange={(v) => setSelectedSupplierId(v)}
                  options={supplierOptions}
                />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Dati contrattuali ── */}
        <Card title="Dati Contrattuali" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Stato Contratto" initialValue="attivo">
                <Select>
                  <Option value="attivo">Attivo</Option>
                  <Option value="non_attivo">Non Attivo</Option>
                  <Option value="in_rinegoziazione">In Rinegoziazione</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="ente_stipulante" label="Ente Stipulante">
                <Select allowClear>
                  <Option value="struttura">Struttura</Option>
                  <Option value="ricerca">Ricerca</Option>
                  <Option value="entrambi">Entrambi</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="cdc" label="CDC">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="cig_cup_commessa" label="CIG / CUP / Commessa">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="oggetto" label="Oggetto del Contratto" rules={[{ required: true }]}>
                <TextArea rows={3} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="imponibile" label="Imponibile (€)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2}
                  formatter={v => `€ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col xs={24} md={4}>
              <Form.Item name="iva_percentuale" label="IVA (%)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} precision={2} />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item name="ivato" label="Totale IVA Inclusa (€)">
                <InputNumber style={{ width: '100%' }} min={0} precision={2} disabled
                  formatter={v => `€ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Date ── */}
        <Card title="Date e Scadenze" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item name="data_inizio" label="Data Inizio">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="data_scadenza" label="Data Scadenza">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="data_rinegoziazione" label="Data Rinegoziazione">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="recesso_anticipato" label="Recesso Anticipato">
                <Input placeholder="Note sul recesso..." />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="alert_enabled" label="Alert Notifiche" valuePropName="checked" initialValue={true}>
                <Switch checkedChildren="Attivo" unCheckedChildren="Disattivato" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="rinnovo_tacito" label="Rinnovo Tacito" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Privacy / IT ── */}
        <Card title="Adempimenti Privacy e IT" style={{ marginBottom: 16 }}>
          <Row gutter={32}>
            <Col>
              <Form.Item name="dpa" label="DPA (Data Processing Agreement)" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="questionario_it_gdpr" label="Questionario IT GDPR" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col>
              <Form.Item name="dpia" label="DPIA (Data Protection Impact Assessment)" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Referenti ── */}
        <Card title="Referenti" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="referente_interno" label="Referente Interno">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="referente_ufficio_acquisti" label="Referente Ufficio Acquisti">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="riferimento_gara" label="Rif. Gara / Procedura">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Ordini associati (solo in modifica) ── */}
        {isEdit && (
          <Card
            title="Ordini Alyante Associati"
            style={{ marginBottom: 16 }}
            extra={
              <Button
                icon={<LinkOutlined />}
                size="small"
                disabled={!selectedSupplierId}
                onClick={() => loadAvailableOrders(selectedSupplierId!)}
              >
                Associa ordine
              </Button>
            }
          >
            <Table
              dataSource={linkedOrders}
              rowKey="id"
              columns={orderColumns}
              size="small"
              pagination={false}
              locale={{ emptyText: 'Nessun ordine associato. Usa "Associa ordine" per collegare ordini Alyante.' }}
            />
          </Card>
        )}

        <Space>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
            {isEdit ? 'Salva Modifiche' : 'Crea Contratto'}
          </Button>
          <Button onClick={() => navigate(isEdit ? `/contracts/${id}` : '/contracts')}>Annulla</Button>
        </Space>
      </Form>

      {/* Modal selezione ordini */}
      <Modal
        title="Seleziona ordini da associare"
        open={orderModalOpen}
        onCancel={() => setOrderModalOpen(false)}
        footer={null}
        width={900}
      >
        <Table
          dataSource={availableOrders}
          rowKey="alyante_order_id"
          columns={availableOrderColumns}
          size="small"
          pagination={false}
          locale={{ emptyText: 'Tutti gli ordini del fornitore sono già associati a un contratto.' }}
        />
      </Modal>
    </div>
  )
}
