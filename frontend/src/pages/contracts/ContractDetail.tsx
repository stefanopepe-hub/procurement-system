import React, { useState, useEffect } from 'react'
import {
  Tabs, Card, Descriptions, Tag, Table, Button, Typography, Space,
  Spin, Alert, Divider, message, Row, Col, Upload, Select, Progress,
  List, Badge, Tooltip, Collapse
} from 'antd'
import {
  ArrowLeftOutlined, EditOutlined, UploadOutlined,
  FileTextOutlined, ShoppingOutlined, MailOutlined, WarningOutlined,
  RobotOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ExclamationCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { contractsApi, aiApi } from '../../services/api'
import api from '../../services/api'
import type { ContractDetail as ContractDetailType } from '../../types'

const { Title, Text } = Typography

const STATUS_LABELS: Record<string, string> = {
  attivo: 'Attivo', non_attivo: 'Non Attivo', in_rinegoziazione: 'In Rinegoziazione',
}
const STATUS_COLORS: Record<string, string> = {
  attivo: 'green', non_attivo: 'default', in_rinegoziazione: 'blue',
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return dayjs(dateStr).diff(dayjs(), 'day')
}

function ExpiryTag({ date }: { date: string | null }) {
  if (!date) return <span>—</span>
  const d = daysUntil(date)
  const formatted = new Date(date).toLocaleDateString('it-IT')
  if (d !== null && d <= 0) return <Tag color="red"><WarningOutlined /> {formatted} (scaduto)</Tag>
  if (d !== null && d <= 30) return <Tag color="red">{formatted} ({d}gg)</Tag>
  if (d !== null && d <= 60) return <Tag color="orange">{formatted} ({d}gg)</Tag>
  return <Tag color="green">{formatted}</Tag>
}

export const ContractDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [contract, setContract] = useState<ContractDetailType | null>(null)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // AI Analysis state
  const [aiAnalysis, setAiAnalysis] = useState<any | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [selectedDocId, setSelectedDocId] = useState<number | undefined>()

  useEffect(() => {
    const load = async () => {
      try {
        const [cRes, oRes] = await Promise.all([
          contractsApi.get(Number(id)),
          api.get(`/contracts/${id}/orders`),
        ])
        setContract(cRes.data)
        setOrders(oRes.data)
      } catch {
        message.error('Contratto non trovato')
        navigate('/contracts')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />
  if (!contract) return <Alert type="error" message="Contratto non trovato" />

  const RISK_COLOR: Record<string, string> = {
    basso: 'success', medio: 'warning', alto: 'error', critico: 'error',
  }
  const RISK_HEX: Record<string, string> = {
    basso: '#52c41a', medio: '#faad14', alto: '#ff7a00', critico: '#ff4d4f',
  }

  const runAiAnalysis = async () => {
    if (!selectedDocId || !id) return
    setAiLoading(true)
    setAiAnalysis(null)
    try {
      const res = await aiApi.analyzeContract(Number(id), selectedDocId)
      setAiAnalysis(res.data)
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Errore durante l\'analisi AI')
    } finally {
      setAiLoading(false)
    }
  }

  const pdfDocuments = contract?.documents?.filter(d => d.nome_file?.toLowerCase().endsWith('.pdf')) || []

  const tabs = [
    {
      key: 'info',
      label: <><FileTextOutlined /> Dati Contratto</>,
      children: (
        <Card>
          <Descriptions bordered column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="ID Contratto">
              <Text code>{contract.id_contratto}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Stato">
              <Tag color={STATUS_COLORS[contract.status]}>{STATUS_LABELS[contract.status]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ente Stipulante">
              {contract.ente_stipulante ? <Tag>{contract.ente_stipulante}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="CDC">{contract.cdc || '—'}</Descriptions.Item>
            <Descriptions.Item label="CIG/CUP/Commessa">{contract.cig_cup_commessa || '—'}</Descriptions.Item>
            <Descriptions.Item label="Rif. Gara">{contract.riferimento_gara || '—'}</Descriptions.Item>
            <Descriptions.Item label="Oggetto" span={3}>{contract.oggetto}</Descriptions.Item>
            <Descriptions.Item label="Imponibile">
              {contract.imponibile ? `€ ${Number(contract.imponibile).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Totale IVA inclusa">
              {contract.ivato ? `€ ${Number(contract.ivato).toLocaleString('it-IT', { minimumFractionDigits: 2 })}` : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Rinnovo Tacito">
              {contract.rinnovo_tacito ? <Tag color="blue">Sì</Tag> : <Tag>No</Tag>}
            </Descriptions.Item>
          </Descriptions>

          <Divider>Date</Divider>
          <Descriptions bordered column={{ xs: 1, sm: 3 }} size="small">
            <Descriptions.Item label="Data Inizio">
              {contract.data_inizio ? new Date(contract.data_inizio).toLocaleDateString('it-IT') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Data Scadenza">
              <ExpiryTag date={contract.data_scadenza} />
            </Descriptions.Item>
            <Descriptions.Item label="Data Rinegoziazione">
              <ExpiryTag date={contract.data_rinegoziazione} />
            </Descriptions.Item>
            <Descriptions.Item label="Recesso Anticipato" span={3}>
              {contract.recesso_anticipato || '—'}
            </Descriptions.Item>
          </Descriptions>

          <Divider>Adempimenti Privacy / IT</Divider>
          <Space size="large">
            <Tag color={contract.dpa ? 'purple' : 'default'}>DPA: {contract.dpa ? 'Sì' : 'No'}</Tag>
            <Tag color={contract.questionario_it_gdpr ? 'blue' : 'default'}>Questionario GDPR: {contract.questionario_it_gdpr ? 'Sì' : 'No'}</Tag>
            <Tag color={contract.dpia ? 'cyan' : 'default'}>DPIA: {contract.dpia ? 'Sì' : 'No'}</Tag>
            <Tag color={contract.alert_enabled ? 'success' : 'default'}>Alert: {contract.alert_enabled ? 'Attivo' : 'Disattivato'}</Tag>
          </Space>

          <Divider>Referenti</Divider>
          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="Referente Interno">{contract.referente_interno || '—'}</Descriptions.Item>
            <Descriptions.Item label="Referente UA">{contract.referente_ufficio_acquisti || '—'}</Descriptions.Item>
          </Descriptions>
        </Card>
      ),
    },
    {
      key: 'orders',
      label: <><ShoppingOutlined /> Ordini Associati ({orders.length})</>,
      children: (
        <Card
          extra={
            <Button icon={<EditOutlined />} onClick={() => navigate(`/contracts/${id}/edit`)}>
              Gestisci associazioni
            </Button>
          }
        >
          <Table
            dataSource={orders}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Protocollo', dataIndex: 'protocollo', key: 'prot' },
              { title: 'Tipo', dataIndex: 'tipo_documento', key: 'tipo', render: (v: string) => <Tag>{v}</Tag> },
              { title: 'Oggetto', dataIndex: 'oggetto', key: 'ogg', ellipsis: true },
              { title: 'Data Ordine', dataIndex: 'data_ordine', key: 'data',
                render: (v: string) => v ? new Date(v).toLocaleDateString('it-IT') : '—' },
              { title: 'Importo €', dataIndex: 'importo', key: 'imp',
                render: (v: number) => v?.toLocaleString('it-IT', { minimumFractionDigits: 2 }) || '—' },
              { title: 'Stato', dataIndex: 'stato', key: 'stato', render: (v: string) => <Tag>{v}</Tag> },
              { title: 'CDC', dataIndex: 'cdc', key: 'cdc', render: (v: string) => v || '—' },
            ]}
            locale={{ emptyText: 'Nessun ordine associato' }}
          />
        </Card>
      ),
    },
    {
      key: 'documents',
      label: <><FileTextOutlined /> Documenti ({contract.documents?.length || 0})</>,
      children: (
        <Card
          extra={
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                contractsApi.uploadDocument(Number(id), 'Contratto', file)
                  .then(() => {
                    message.success('Documento caricato')
                    contractsApi.get(Number(id)).then(r => setContract(r.data))
                  })
                return false
              }}
            >
              <Button icon={<UploadOutlined />}>Carica documento</Button>
            </Upload>
          }
        >
          <Table
            dataSource={contract.documents}
            rowKey="id"
            size="small"
            pagination={false}
            columns={[
              { title: 'Tipo', dataIndex: 'tipo', key: 'tipo' },
              { title: 'File', dataIndex: 'nome_file', key: 'file',
                render: (v: string) => <Button type="link" size="small">{v}</Button> },
              { title: 'Caricato il', dataIndex: 'data_upload', key: 'upload',
                render: (v: string) => new Date(v).toLocaleDateString('it-IT') },
            ]}
            locale={{ emptyText: 'Nessun documento' }}
          />
        </Card>
      ),
    },
    {
      key: 'communications',
      label: <><MailOutlined /> Comunicazioni</>,
      children: (
        <Table
          dataSource={contract.communications}
          rowKey="id"
          size="small"
          columns={[
            { title: 'Tipo', dataIndex: 'tipo', key: 'tipo', render: (v: string) => <Tag>{v}</Tag> },
            { title: 'Oggetto', dataIndex: 'oggetto', key: 'ogg', ellipsis: true },
            { title: 'Inviata', dataIndex: 'inviata_at', key: 'at',
              render: (v: string) => v ? new Date(v).toLocaleString('it-IT') : '—' },
            { title: 'Tipo invio', dataIndex: 'is_auto', key: 'auto',
              render: (v: boolean) => <Tag color={v ? 'blue' : 'green'}>{v ? 'Automatico' : 'Manuale'}</Tag> },
            { title: 'Stato', dataIndex: 'status', key: 'status',
              render: (v: string) => <Tag color={v === 'sent' ? 'success' : 'error'}>{v}</Tag> },
          ]}
          locale={{ emptyText: 'Nessuna comunicazione' }}
        />
      ),
    },
    {
      key: 'ai',
      label: <><RobotOutlined /> Analisi AI</>,
      children: (
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Document selector + trigger */}
          <Card
            title={<Space><RobotOutlined /><span>Analisi contratto con Claude AI</span></Space>}
          >
            {pdfDocuments.length === 0 ? (
              <Alert
                type="info"
                message="Nessun documento PDF disponibile"
                description="Carica prima un documento PDF nella scheda Documenti per poter avviare l'analisi AI."
              />
            ) : (
              <Space wrap>
                <Select
                  placeholder="Seleziona documento PDF da analizzare"
                  style={{ minWidth: 320 }}
                  onChange={(v) => setSelectedDocId(v)}
                  value={selectedDocId}
                  options={pdfDocuments.map((d: any) => ({
                    value: d.id,
                    label: `${d.tipo} — ${d.nome_file}`,
                  }))}
                />
                <Button
                  type="primary"
                  icon={<RobotOutlined />}
                  loading={aiLoading}
                  disabled={!selectedDocId}
                  onClick={runAiAnalysis}
                >
                  Avvia Analisi AI
                </Button>
              </Space>
            )}
          </Card>

          {/* Loading indicator */}
          {aiLoading && (
            <Card>
              <Space direction="vertical" align="center" style={{ width: '100%', padding: '32px 0' }}>
                <Spin size="large" />
                <Text type="secondary">Analisi in corso con Claude AI… può richiedere 15-30 secondi</Text>
              </Space>
            </Card>
          )}

          {/* Analysis results */}
          {aiAnalysis && !aiLoading && (
            <>
              {/* Header / Score */}
              <Card>
                <Row gutter={24} align="middle">
                  <Col xs={24} md={12}>
                    <Title level={4} style={{ margin: 0 }}>
                      {aiAnalysis.documento_nome}
                    </Title>
                    <Text type="secondary">{aiAnalysis.testo_estratto_chars?.toLocaleString('it-IT')} caratteri estratti</Text>
                    <div style={{ marginTop: 12 }}>
                      <Text>{aiAnalysis.riepilogo_esecutivo}</Text>
                    </div>
                  </Col>
                  <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">Conformità complessiva</Text>
                    </div>
                    <Progress
                      type="circle"
                      percent={aiAnalysis.punteggio_conformita}
                      strokeColor={RISK_HEX[aiAnalysis.livello_rischio_generale] || '#1677ff'}
                      size={100}
                    />
                  </Col>
                  <Col xs={24} md={6} style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: 8 }}>
                      <Text type="secondary">Livello di rischio</Text>
                    </div>
                    <Tag
                      color={RISK_COLOR[aiAnalysis.livello_rischio_generale]}
                      style={{ fontSize: 16, padding: '4px 12px' }}
                    >
                      {aiAnalysis.livello_rischio_generale?.toUpperCase()}
                    </Tag>
                  </Col>
                </Row>

                <Divider />

                <Row gutter={16}>
                  {aiAnalysis.parti_contrattuali?.map((p: string, i: number) => (
                    <Col key={i}>
                      <Tag icon={<InfoCircleOutlined />} color="blue">{p}</Tag>
                    </Col>
                  ))}
                  {aiAnalysis.date_chiave?.data_inizio && (
                    <Col><Tag>Inizio: {aiAnalysis.date_chiave.data_inizio}</Tag></Col>
                  )}
                  {aiAnalysis.date_chiave?.data_scadenza && (
                    <Col><Tag color="orange">Scadenza: {aiAnalysis.date_chiave.data_scadenza}</Tag></Col>
                  )}
                  {aiAnalysis.valore_economico && (
                    <Col><Tag color="green">{aiAnalysis.valore_economico}</Tag></Col>
                  )}
                </Row>
              </Card>

              {/* Clauses */}
              <Card title="Clausole standard">
                <Row gutter={[8, 8]}>
                  {aiAnalysis.clausole_standard?.map((c: any, i: number) => (
                    <Col key={i} xs={24} md={12}>
                      <Tooltip title={c.note || c.contenuto || ''}>
                        <Space>
                          {c.presente
                            ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                            : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
                          <Text style={{ color: c.presente ? undefined : '#ff4d4f' }}>
                            {c.nome}
                          </Text>
                        </Space>
                      </Tooltip>
                    </Col>
                  ))}
                </Row>

                {aiAnalysis.clausole_mancanti?.length > 0 && (
                  <>
                    <Divider />
                    <Alert
                      type="warning"
                      icon={<ExclamationCircleOutlined />}
                      message={`${aiAnalysis.clausole_mancanti.length} clausole mancanti o insufficienti`}
                      description={aiAnalysis.clausole_mancanti.join(' • ')}
                    />
                  </>
                )}
              </Card>

              {/* Criticalities */}
              {aiAnalysis.criticita?.length > 0 && (
                <Card
                  title={
                    <Space>
                      <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                      <span>Criticità rilevate ({aiAnalysis.criticita.length})</span>
                    </Space>
                  }
                >
                  <Collapse
                    items={aiAnalysis.criticita.map((c: any, i: number) => ({
                      key: i,
                      label: (
                        <Space>
                          <Badge color={RISK_HEX[c.livello_rischio]} />
                          <Text strong>{c.titolo}</Text>
                          <Tag color={RISK_COLOR[c.livello_rischio]}>{c.livello_rischio}</Tag>
                        </Space>
                      ),
                      children: (
                        <Space direction="vertical" style={{ width: '100%' }}>
                          <Text>{c.descrizione}</Text>
                          <Alert
                            type="info"
                            icon={<InfoCircleOutlined />}
                            message="Raccomandazione"
                            description={c.raccomandazione}
                          />
                        </Space>
                      ),
                    }))}
                  />
                </Card>
              )}

              {/* Recommendations */}
              {aiAnalysis.raccomandazioni?.length > 0 && (
                <Card title="Raccomandazioni">
                  <List
                    dataSource={aiAnalysis.raccomandazioni}
                    renderItem={(item: string, i: number) => (
                      <List.Item>
                        <Space align="start">
                          <Text type="secondary" style={{ minWidth: 24 }}>{i + 1}.</Text>
                          <Text>{item}</Text>
                        </Space>
                      </List.Item>
                    )}
                  />
                </Card>
              )}
            </>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/contracts')}>Database Contratti</Button>
        <Button icon={<EditOutlined />} onClick={() => navigate(`/contracts/${id}/edit`)}>Modifica</Button>
        {contract.supplier_id && (
          <Button onClick={() => navigate(`/suppliers/${contract.supplier_id}`)}>
            Vai al fornitore in Albo
          </Button>
        )}
      </Space>

      <Card style={{ marginBottom: 16 }}>
        <Row align="middle" justify="space-between">
          <Col>
            <Title level={4} style={{ margin: 0 }}>
              <Text code>{contract.id_contratto}</Text> – {contract.ragione_sociale}
            </Title>
            <Space style={{ marginTop: 4 }}>
              <Tag color={STATUS_COLORS[contract.status]}>{STATUS_LABELS[contract.status]}</Tag>
              {contract.rinnovo_tacito && <Tag color="blue">Rinnovo Tacito</Tag>}
              {!contract.alert_enabled && <Tag color="warning">Alert OFF</Tag>}
            </Space>
          </Col>
          <Col>
            <Space direction="vertical" align="end">
              <Text type="secondary">Scadenza</Text>
              <ExpiryTag date={contract.data_scadenza} />
            </Space>
          </Col>
        </Row>
      </Card>

      <Tabs items={tabs} />
    </div>
  )
}
