import React, { useEffect, useState } from 'react'
import {
  Tabs, Card, Descriptions, Tag, Table, Button, Typography, Space,
  Spin, Alert, Badge, Divider, message, Row, Col, Statistic, Modal, Select, Form as AntForm
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, FileTextOutlined,
  TeamOutlined, ShoppingOutlined, MailOutlined, SafetyOutlined, UploadOutlined
} from '@ant-design/icons'
import { Upload } from 'antd'
import DatePicker from 'antd/es/date-picker'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { suppliersApi } from '../../services/api'
import type { SupplierDetail as SupplierDetailType } from '../../types'
import { Semaforo } from '../../components/common/Semaforo'
import { useAuthStore, isAdmin } from '../../store/auth'

const { Title, Text } = Typography

const STATUS_LABELS: Record<string, string> = {
  accreditato: 'Accreditato',
  non_piu_accreditato: 'Non più accreditato',
  sotto_osservazione: 'Sotto osservazione',
  in_riqualifica: 'In riqualifica',
}
const STATUS_COLORS: Record<string, string> = {
  accreditato: 'green',
  non_piu_accreditato: 'red',
  sotto_osservazione: 'orange',
  in_riqualifica: 'blue',
}

export const SupplierDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const admin = isAdmin(user)

  const [supplier, setSupplier] = useState<SupplierDetailType | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [uploadModal, setUploadModal] = useState(false)
  const [uploadForm] = AntForm.useForm()
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await suppliersApi.get(Number(id))
        setSupplier(res.data)
        if (admin && res.data.alyante_code) {
          const ordRes = await suppliersApi.getOrders(res.data.alyante_code)
          setOrders(ordRes.data.orders || [])
        }
      } catch {
        message.error('Fornitore non trovato')
        navigate('/suppliers')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const reloadSupplier = async () => {
    try {
      const res = await suppliersApi.get(Number(id))
      setSupplier(res.data)
    } catch {
      // ignore
    }
  }

  const handleUpload = async (values: any, file: File) => {
    setUploading(true)
    try {
      await suppliersApi.uploadDocument(
        Number(id),
        values.tipo,
        file,
        values.data_scadenza?.format('YYYY-MM-DD')
      )
      message.success('Documento caricato con successo')
      setUploadModal(false)
      uploadForm.resetFields()
      await reloadSupplier()
    } catch {
      message.error('Errore nel caricamento del documento')
    } finally {
      setUploading(false)
    }
  }

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!supplier) return <Alert type="error" message="Fornitore non trovato" />

  const tabItems = [
    {
      key: 'anagrafica',
      label: <><TeamOutlined /> Anagrafica</>,
      children: (
        <Card>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="Ragione Sociale">{supplier.ragione_sociale}</Descriptions.Item>
            <Descriptions.Item label="Cod. Fornitore">{supplier.alyante_code || '—'}</Descriptions.Item>
            <Descriptions.Item label="Personalità Giuridica">
              {supplier.legal_person_type === 'professionista' ? 'Professionista' : supplier.legal_person_type === 'impresa' ? 'Impresa' : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="P.IVA">{supplier.partita_iva || '—'}</Descriptions.Item>
            <Descriptions.Item label="Codice Fiscale">{supplier.codice_fiscale || '—'}</Descriptions.Item>
            <Descriptions.Item label="Totale Ordinato">
              {supplier.totale_ordinato ? `€ ${Number(supplier.totale_ordinato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
            </Descriptions.Item>
          </Descriptions>

          <Divider>Sede Legale</Divider>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="Indirizzo">{supplier.sede_legale_indirizzo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Comune">{supplier.sede_legale_comune || '—'}</Descriptions.Item>
            <Descriptions.Item label="Provincia">{supplier.sede_legale_provincia || '—'}</Descriptions.Item>
            <Descriptions.Item label="Regione">{supplier.sede_legale_regione || '—'}</Descriptions.Item>
            <Descriptions.Item label="CAP">{supplier.sede_legale_cap || '—'}</Descriptions.Item>
            <Descriptions.Item label="Nazione">{supplier.sede_legale_nazione || '—'}</Descriptions.Item>
            <Descriptions.Item label="Web">{supplier.sede_legale_web ? <a href={supplier.sede_legale_web} target="_blank" rel="noreferrer">{supplier.sede_legale_web}</a> : '—'}</Descriptions.Item>
          </Descriptions>

          <Divider>Sede Operativa</Divider>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="Indirizzo">{supplier.sede_operativa_indirizzo || '—'}</Descriptions.Item>
            <Descriptions.Item label="Comune">{supplier.sede_operativa_comune || '—'}</Descriptions.Item>
            <Descriptions.Item label="Provincia">{supplier.sede_operativa_provincia || '—'}</Descriptions.Item>
            <Descriptions.Item label="CAP">{supplier.sede_operativa_cap || '—'}</Descriptions.Item>
          </Descriptions>

          <Divider>Referenti</Divider>
          <Table
            dataSource={supplier.contacts}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Nome', dataIndex: 'nome', key: 'nome' },
              { title: 'Cognome', dataIndex: 'cognome', key: 'cognome' },
              { title: 'Qualifica', dataIndex: 'qualifica', key: 'qualifica' },
              { title: 'Telefono', dataIndex: 'telefono1', key: 'tel', render: (v, r: any) => [v, r.telefono2].filter(Boolean).join(' / ') || '—' },
              { title: 'Email', dataIndex: 'email1', key: 'email', render: (v, r: any) => [v, r.email2].filter(Boolean).join(', ') || '—' },
              { title: 'Primario', dataIndex: 'is_primary', key: 'primary', render: (v) => v ? <Tag color="blue">Primario</Tag> : null },
            ]}
          />

          {supplier.fatturati?.length > 0 && (
            <>
              <Divider>Fatturato</Divider>
              <Table
                dataSource={supplier.fatturati}
                rowKey="id"
                size="small"
                pagination={false}
                columns={[
                  { title: 'Anno', dataIndex: 'anno', key: 'anno' },
                  { title: 'Fatturato (€)', dataIndex: 'fatturato', key: 'fatturato',
                    render: (v) => v ? Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2 }) : '—' },
                ]}
              />
            </>
          )}
        </Card>
      ),
    },
    ...(admin ? [
      {
        key: 'qualifica',
        label: <><SafetyOutlined /> Qualifica</>,
        children: (
          <Card>
            <Descriptions bordered column={2} size="small">
              <Descriptions.Item label="Stato">
                <Tag color={STATUS_COLORS[supplier.status]}>{STATUS_LABELS[supplier.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tipo Accreditamento">
                {supplier.accreditament_type ? (
                  <Tag color={supplier.accreditament_type === 'strategico' ? 'purple' : 'cyan'}>
                    {supplier.accreditament_type === 'strategico' ? 'Strategico' : 'Preferenziale'}
                  </Tag>
                ) : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Data Iscrizione">
                {supplier.data_iscrizione ? new Date(supplier.data_iscrizione).toLocaleDateString('it-IT') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Data Riqualifica">
                {supplier.data_riqualifica ? new Date(supplier.data_riqualifica).toLocaleDateString('it-IT') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Settore">
                {supplier.settore_attivita || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Categorie Merceologiche">
                {supplier.categorie_merceologiche?.join(', ') || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Maggiori Clienti" span={2}>
                {supplier.maggiori_clienti || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Note Interne" span={2}>
                {supplier.note_interne || '—'}
              </Descriptions.Item>
            </Descriptions>

            <Divider>Certificazioni</Divider>
            <Table
              dataSource={supplier.certifications}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Certificazione', dataIndex: 'nome', key: 'nome' },
                { title: 'Numero', dataIndex: 'numero', key: 'numero', render: (v) => v || '—' },
                { title: 'Ente', dataIndex: 'ente_rilascio', key: 'ente', render: (v) => v || '—' },
                { title: 'Scadenza', dataIndex: 'data_scadenza', key: 'scadenza',
                  render: (v) => v ? <span style={{ color: new Date(v) < new Date() ? 'red' : 'inherit' }}>
                    {new Date(v).toLocaleDateString('it-IT')}
                    {new Date(v) < new Date() && ' ⚠️'}
                  </span> : '—' },
              ]}
            />

            <Divider>Documenti Societari</Divider>
            <Space style={{ marginBottom: 12 }}>
              <Button icon={<UploadOutlined />} onClick={() => setUploadModal(true)}>
                Carica Documento
              </Button>
            </Space>
            <Table
              dataSource={supplier.documents}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Tipo', dataIndex: 'tipo', key: 'tipo' },
                { title: 'File', dataIndex: 'nome_file', key: 'file',
                  render: (v) => <Button type="link" size="small">{v}</Button> },
                { title: 'Scadenza', dataIndex: 'data_scadenza', key: 'scadenza',
                  render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—' },
                { title: 'Caricato il', dataIndex: 'data_upload', key: 'upload',
                  render: (v) => new Date(v).toLocaleDateString('it-IT') },
              ]}
            />

            <Modal
              title="Carica Documento"
              open={uploadModal}
              onCancel={() => { setUploadModal(false); uploadForm.resetFields() }}
              footer={null}
            >
              <AntForm form={uploadForm} layout="vertical">
                <AntForm.Item name="tipo" label="Tipo Documento" rules={[{ required: true, message: 'Seleziona il tipo di documento' }]}>
                  <Select options={[
                    { value: 'DURC', label: 'DURC' },
                    { value: 'Visura Camerale', label: 'Visura Camerale' },
                    { value: 'ISO 9001', label: 'Certificazione ISO 9001' },
                    { value: 'Polizza RC', label: 'Polizza RC' },
                    { value: 'DUVRI', label: 'DUVRI' },
                    { value: 'Altro', label: 'Altro' },
                  ]} />
                </AntForm.Item>
                <AntForm.Item name="data_scadenza" label="Data Scadenza">
                  <DatePicker style={{ width: '100%' }} />
                </AntForm.Item>
                <Upload
                  beforeUpload={(file) => {
                    uploadForm.validateFields().then(values => handleUpload(values, file))
                    return false
                  }}
                  accept=".pdf,.doc,.docx,.jpg,.png"
                  showUploadList={false}
                >
                  <Button icon={<UploadOutlined />} loading={uploading} type="primary">
                    Seleziona e Carica File
                  </Button>
                </Upload>
              </AntForm>
            </Modal>
          </Card>
        ),
      },
      {
        key: 'ordini',
        label: <><ShoppingOutlined /> Ordini</>,
        children: (
          <Table
            dataSource={orders}
            rowKey="id"
            size="small"
            columns={[
              { title: 'Protocollo', dataIndex: 'numero', key: 'numero' },
              { title: 'Data', dataIndex: 'data', key: 'data',
                render: (v) => v ? new Date(v).toLocaleDateString('it-IT') : '—' },
              { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v) => <Tag>{v}</Tag> },
              { title: 'Oggetto', dataIndex: 'oggetto', key: 'oggetto', ellipsis: true },
              { title: 'Importo (€)', dataIndex: 'importo', key: 'importo',
                render: (v) => v?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '—' },
              { title: 'Stato', dataIndex: 'stato', key: 'stato', render: (v) => <Tag>{v}</Tag> },
            ]}
          />
        ),
      },
      {
        key: 'contratti',
        label: <><FileTextOutlined /> Contratti</>,
        children: (
          <Alert
            type="info"
            message="Contratti associati al fornitore"
            description={
              <Button type="link" onClick={() => navigate(`/contracts?supplier_id=${id}`)}>
                Visualizza i contratti nel Database Contratti →
              </Button>
            }
          />
        ),
      },
      {
        key: 'comunicazioni',
        label: <><MailOutlined /> Comunicazioni</>,
        children: (
          <Table
            dataSource={supplier.communications}
            rowKey="id"
            size="small"
            columns={[
              { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v) => <Tag>{v}</Tag> },
              { title: 'Oggetto', dataIndex: 'oggetto', key: 'oggetto', ellipsis: true },
              { title: 'Data Invio', dataIndex: 'inviata_at', key: 'inviata_at',
                render: (v) => v ? new Date(v).toLocaleString('it-IT') : '—' },
              { title: 'Tipo Invio', dataIndex: 'is_auto', key: 'auto',
                render: (v) => <Tag color={v ? 'blue' : 'green'}>{v ? 'Automatico' : 'Manuale'}</Tag> },
              { title: 'Stato', dataIndex: 'status', key: 'status',
                render: (v) => <Tag color={v === 'sent' ? 'success' : 'error'}>{v}</Tag> },
            ]}
          />
        ),
      },
    ] : []),
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/suppliers')}>
          Albo Fornitori
        </Button>
        {admin && (
          <Button icon={<EditOutlined />} onClick={() => navigate(`/suppliers/${id}/edit`)}>
            Modifica
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Space align="start">
              <Semaforo status={supplier.semaforo} size={24} />
              <div>
                <Title level={4} style={{ margin: 0 }}>{supplier.ragione_sociale}</Title>
                <Space>
                  <Tag color={STATUS_COLORS[supplier.status]}>{STATUS_LABELS[supplier.status]}</Tag>
                  {supplier.accreditament_type && (
                    <Tag color={supplier.accreditament_type === 'strategico' ? 'purple' : 'cyan'}>
                      {supplier.accreditament_type === 'strategico' ? 'Strategico' : 'Preferenziale'}
                    </Tag>
                  )}
                  {supplier.alyante_code && <Text type="secondary">#{supplier.alyante_code}</Text>}
                </Space>
              </div>
            </Space>
          </Col>
          <Col>
            <Semaforo status={supplier.semaforo} size={32} showLabel />
          </Col>
        </Row>
      </Card>

      <Tabs items={tabItems} />
    </div>
  )
}
