import React, { useState } from 'react'
import {
  Typography, Card, Form, Input, Select, Button, Alert, Table, Space,
  Tag, Divider, Row, Col,
} from 'antd'
import {
  DeleteOutlined, SendOutlined, FileSearchOutlined,
} from '@ant-design/icons'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

interface RichiestaForm {
  nome: string
  email: string
  tipo_richiesta: string
  descrizione: string
}

const TIPO_OPTIONS = [
  { value: 'cancellazione', label: 'Cancellazione dati' },
  { value: 'rettifica', label: 'Rettifica' },
  { value: 'portabilita', label: 'Portabilità' },
  { value: 'opposizione', label: 'Opposizione' },
]

const TIPO_COLOR: Record<string, string> = {
  cancellazione: 'red',
  rettifica: 'orange',
  portabilita: 'blue',
  opposizione: 'purple',
}

const emptyColumns = [
  { title: 'Protocollo', dataIndex: 'protocollo', key: 'protocollo' },
  { title: 'Richiedente', dataIndex: 'richiedente', key: 'richiedente' },
  { title: 'Tipo Richiesta', dataIndex: 'tipo', key: 'tipo' },
  { title: 'Data Ricezione', dataIndex: 'data', key: 'data' },
  {
    title: 'Stato',
    dataIndex: 'stato',
    key: 'stato',
    render: (v: string) => v ? <Tag color="green">{v}</Tag> : null,
  },
]

const DirittoOblio: React.FC = () => {
  const [form] = Form.useForm<RichiestaForm>()
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (values: RichiestaForm) => {
    setLoading(true)
    // Simulate async operation
    await new Promise(resolve => setTimeout(resolve, 800))
    setLoading(false)
    setSubmitted(true)
    form.resetFields()
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ marginBottom: 4 }}>
          <DeleteOutlined style={{ marginRight: 8, color: '#d46b08' }} />
          Richieste Diritto all'Oblio (Art. 17 GDPR)
        </Title>
        <Text type="secondary">
          Gestione delle richieste di cancellazione, rettifica, portabilità e opposizione al trattamento dei dati personali
        </Text>
      </div>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <Space>
                <SendOutlined />
                <span>Nuova Richiesta</span>
                <Tag color="orange">Art. 17 GDPR</Tag>
              </Space>
            }
          >
            <Alert
              type="info"
              showIcon
              message="Procedura di esercizio dei diritti GDPR"
              description={
                <Paragraph style={{ marginBottom: 0 }}>
                  Ai sensi degli Artt. 15-22 del Regolamento UE 2016/679 (GDPR), gli interessati
                  hanno il diritto di richiedere l'accesso, la rettifica, la cancellazione
                  (&quot;diritto all'oblio&quot;), la limitazione del trattamento, la portabilità dei dati
                  e di opporsi al trattamento. Le richieste vengono evase entro 30 giorni dalla
                  ricezione ai sensi dell'Art. 12 GDPR.
                </Paragraph>
              }
              style={{ marginBottom: 24 }}
            />

            {submitted && (
              <Alert
                type="success"
                showIcon
                message="Richiesta registrata con successo"
                description="Sarete contattati entro 30 giorni ai sensi dell'Art. 12 GDPR."
                style={{ marginBottom: 24 }}
                closable
                onClose={() => setSubmitted(false)}
              />
            )}

            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
            >
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="nome"
                    label="Nome richiedente"
                    rules={[{ required: true, message: 'Inserire il nome del richiedente' }]}
                  >
                    <Input placeholder="Nome e Cognome" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Inserire l\'indirizzo email' },
                      { type: 'email', message: 'Inserire un\'email valida' },
                    ]}
                  >
                    <Input placeholder="indirizzo@email.com" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="tipo_richiesta"
                label="Tipo di richiesta"
                rules={[{ required: true, message: 'Selezionare il tipo di richiesta' }]}
              >
                <Select placeholder="Seleziona il tipo di richiesta">
                  {TIPO_OPTIONS.map(opt => (
                    <Option key={opt.value} value={opt.value}>
                      <Tag color={TIPO_COLOR[opt.value]}>{opt.label}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                name="descrizione"
                label="Descrizione della richiesta"
                rules={[{ required: true, message: 'Descrivere la richiesta' }]}
              >
                <TextArea
                  rows={4}
                  placeholder="Descrivere in dettaglio la richiesta, specificando i dati oggetto della richiesta e le motivazioni..."
                  showCount
                  maxLength={2000}
                />
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<SendOutlined />}
                  loading={loading}
                >
                  Invia Richiesta
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        <Col xs={24} lg={10}>
          <Card
            title={
              <Space>
                <FileSearchOutlined />
                <span>Informazioni</span>
              </Space>
            }
            size="small"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              {[
                { label: 'Titolare del trattamento', value: 'Fondazione Telethon' },
                { label: 'Responsabile DPO', value: 'Da nominare' },
                { label: 'Email DPO', value: 'dpo@telethon.it' },
                { label: 'Termine di risposta', value: '30 giorni (Art. 12 GDPR)' },
                { label: 'Proroga eventuale', value: '+60 giorni per richieste complesse' },
              ].map(item => (
                <div key={item.label}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{item.label}</Text>
                  <br />
                  <Text strong style={{ fontSize: 13 }}>{item.value}</Text>
                </div>
              ))}
            </Space>
          </Card>
        </Col>
      </Row>

      <Divider />

      <Card
        title={
          <Space>
            <FileSearchOutlined />
            <span>Registro Richieste Precedenti</span>
          </Space>
        }
      >
        <Table
          dataSource={[]}
          columns={emptyColumns}
          rowKey="id"
          pagination={false}
          locale={{
            emptyText: (
              <Space direction="vertical" style={{ padding: 24 }}>
                <DeleteOutlined style={{ fontSize: 32, color: '#d9d9d9' }} />
                <Text type="secondary">Nessuna richiesta registrata</Text>
              </Space>
            ),
          }}
        />
      </Card>
    </div>
  )
}

export default DirittoOblio
