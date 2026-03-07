import React from 'react'
import {
  Typography, Table, Alert, Button, Tooltip, Tag, Space, Card,
} from 'antd'
import {
  BookOutlined, SafetyCertificateOutlined, FilePdfOutlined,
} from '@ant-design/icons'

const { Title, Text } = Typography

interface TrattamentoRow {
  key: string
  trattamento: string
  base_giuridica: string
  finalita: string
  categorie_dati: string
  conservazione: string
}

const TRATTAMENTI: TrattamentoRow[] = [
  {
    key: '1',
    trattamento: 'Gestione Fornitori',
    base_giuridica: 'Art. 6(1)(b) – Contratto',
    finalita: 'Gestione rapporti commerciali',
    categorie_dati: 'Dati anagrafici, fiscali, contatti',
    conservazione: '10 anni',
  },
  {
    key: '2',
    trattamento: 'Gestione Contratti',
    base_giuridica: 'Art. 6(1)(c) – Obbligo legale',
    finalita: 'Adempimenti contrattuali',
    categorie_dati: 'Dati anagrafici, finanziari',
    conservazione: '10 anni',
  },
  {
    key: '3',
    trattamento: 'Valutazione Fornitori',
    base_giuridica: 'Art. 6(1)(f) – Interesse legittimo',
    finalita: 'Qualità servizi',
    categorie_dati: 'Dati prestazionali',
    conservazione: '5 anni',
  },
  {
    key: '4',
    trattamento: 'Audit Log',
    base_giuridica: 'Art. 6(1)(c) – Obbligo legale',
    finalita: 'Sicurezza e compliance NIS2',
    categorie_dati: 'Dati di accesso, azioni',
    conservazione: '2 anni',
  },
  {
    key: '5',
    trattamento: 'Notifiche Email',
    base_giuridica: 'Art. 6(1)(b) – Contratto',
    finalita: 'Comunicazioni operative',
    categorie_dati: 'Email business',
    conservazione: '1 anno',
  },
]

const BASE_GIURIDICA_COLOR: Record<string, string> = {
  'Art. 6(1)(b) – Contratto': 'blue',
  'Art. 6(1)(c) – Obbligo legale': 'green',
  'Art. 6(1)(f) – Interesse legittimo': 'orange',
}

const columns = [
  {
    title: 'Trattamento',
    dataIndex: 'trattamento',
    key: 'trattamento',
    render: (v: string) => <Text strong>{v}</Text>,
  },
  {
    title: 'Base Giuridica',
    dataIndex: 'base_giuridica',
    key: 'base_giuridica',
    render: (v: string) => (
      <Tag color={BASE_GIURIDICA_COLOR[v] || 'default'} style={{ whiteSpace: 'normal' }}>
        {v}
      </Tag>
    ),
  },
  {
    title: 'Finalità',
    dataIndex: 'finalita',
    key: 'finalita',
  },
  {
    title: 'Categorie Dati',
    dataIndex: 'categorie_dati',
    key: 'categorie_dati',
    render: (v: string) => <Text type="secondary">{v}</Text>,
  },
  {
    title: 'Conservazione',
    dataIndex: 'conservazione',
    key: 'conservazione',
    width: 120,
    render: (v: string) => <Tag color="purple">{v}</Tag>,
  },
]

const RegistroTrattamenti: React.FC = () => (
  <div>
    <div style={{ marginBottom: 24 }}>
      <Title level={3} style={{ marginBottom: 4 }}>
        <BookOutlined style={{ marginRight: 8, color: '#1a3a5c' }} />
        Registro dei Trattamenti (Art. 30 GDPR)
      </Title>
      <Text type="secondary">
        Registro delle attività di trattamento ai sensi del Regolamento UE 2016/679 (GDPR)
      </Text>
    </div>

    <Alert
      type="info"
      showIcon
      icon={<SafetyCertificateOutlined />}
      message="Documento generato automaticamente. Verificare con il DPO aziendale."
      description="I dati riportati in questa tabella sono indicativi e devono essere validati e approvati dal Data Protection Officer (DPO) prima di essere considerati definitivi."
      style={{ marginBottom: 24 }}
    />

    <Card
      title={
        <Space>
          <BookOutlined />
          <span>Attività di Trattamento</span>
          <Tag color="blue">Art. 30 GDPR</Tag>
        </Space>
      }
      extra={
        <Tooltip title="Funzione in arrivo">
          <Button
            icon={<FilePdfOutlined />}
            disabled
          >
            Esporta PDF
          </Button>
        </Tooltip>
      }
    >
      <Table
        dataSource={TRATTAMENTI}
        columns={columns}
        rowKey="key"
        pagination={false}
        size="middle"
        scroll={{ x: 800 }}
        footer={() => (
          <Text type="secondary" style={{ fontSize: 12 }}>
            Ultima revisione: da concordare con il DPO · Titolare del trattamento: Fondazione Telethon
          </Text>
        )}
      />
    </Card>
  </div>
)

export default RegistroTrattamenti
