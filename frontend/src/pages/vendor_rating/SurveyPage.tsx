import React, { useState, useEffect } from 'react'
import {
  Card, Rate, Button, Form, Input, Alert, Typography, Space, Spin,
  Result, Row, Col, Tag, Divider
} from 'antd'
import {
  CheckCircleOutlined, CloseCircleOutlined,
  TrophyOutlined, ClockCircleOutlined, MessageOutlined
} from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { vendorRatingApi } from '../../services/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

// ─── 3 KPI Fondazione Telethon ───────────────────────────────────────────────
const KPI_LABELS = [
  {
    key: 'kpi1',
    icon: <TrophyOutlined style={{ fontSize: 22, color: '#1a3a5c' }} />,
    label: 'Qualità della fornitura',
    description: 'Valuta la conformità e la qualità dei prodotti/servizi ricevuti rispetto a quanto richiesto.',
  },
  {
    key: 'kpi2',
    icon: <ClockCircleOutlined style={{ fontSize: 22, color: '#1a3a5c' }} />,
    label: 'Rispetto delle tempistiche di consegna',
    description: 'Valuta la puntualità del fornitore rispetto alle date di consegna concordate.',
  },
  {
    key: 'kpi3',
    icon: <MessageOutlined style={{ fontSize: 22, color: '#1a3a5c' }} />,
    label: 'Comunicazione e supporto del fornitore',
    description: 'Valuta la disponibilità e la chiarezza nella gestione della fornitura e nella risoluzione di eventuali problemi.',
  },
]

const STAR_LABELS = ['Scarso', 'Insufficiente', 'Sufficiente', 'Buono', 'Ottimo']

export const SurveyPage: React.FC = () => {
  const { token } = useParams<{ token: string }>()
  const [surveyInfo, setSurveyInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [form] = Form.useForm()
  const [ratings, setRatings] = useState<Record<string, number | null>>({})
  const [avgRating, setAvgRating] = useState<number | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await vendorRatingApi.getSurvey(token!)
        setSurveyInfo(res.data)
        if (res.data.is_completed) setSubmitted(true)
      } catch {
        setSurveyInfo(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [token])

  const updateAvg = (newRatings: Record<string, number | null>) => {
    const vals = Object.values(newRatings).filter((v) => v !== null && v !== undefined) as number[]
    setAvgRating(vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null)
  }

  const onFinish = async (values: any) => {
    setSubmitting(true)
    try {
      await vendorRatingApi.submitSurvey({
        token,
        note: values.note || null,
        kpi1: ratings.kpi1 || null,
        kpi2: ratings.kpi2 || null,
        kpi3: ratings.kpi3 || null,
        kpi4: null,
      })
      setSubmitted(true)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (detail?.includes('note') || detail?.includes('Note')) {
        form.setFields([{ name: 'note', errors: ['Le note sono obbligatorie per valutazioni insufficienti (media < 3 stelle)'] }])
      } else {
        form.setFields([{ name: 'note', errors: [detail || 'Errore durante l\'invio. Riprova.'] }])
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Spin size="large" />
    </div>
  )

  if (!surveyInfo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Result status="404" title="Valutazione non trovata"
        subTitle="Il link di valutazione non è valido o è stato rimosso." />
    </div>
  )

  if (surveyInfo.is_expired) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Result
        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        status="error"
        title="Valutazione scaduta"
        subTitle="Il link è scaduto (limite: 30 giorni dall'invio). Contatta l'ufficio acquisti."
      />
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f7fa' }}>
      <Card style={{ maxWidth: 520, width: '100%', textAlign: 'center', borderRadius: 16 }}>
        <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
        <Title level={3}>Grazie per la tua valutazione!</Title>
        <Paragraph type="secondary">
          La valutazione di <strong>{surveyInfo.ragione_sociale}</strong> è stata registrata con successo.
          Il tuo contributo ci aiuta a migliorare la qualità delle forniture.
        </Paragraph>
        <Divider />
        <Text type="secondary" style={{ fontSize: 12 }}>Fondazione Telethon – Ufficio Acquisti</Text>
      </Card>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', padding: '32px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Header branding */}
        <Card style={{ marginBottom: 20, borderRadius: 14, overflow: 'hidden' }} bodyStyle={{ padding: 0 }}>
          <div style={{
            background: 'linear-gradient(135deg, #1a3a5c 0%, #E31837 100%)',
            padding: '28px 32px', textAlign: 'center',
          }}>
            <img src="/telethon-logo.svg" alt="Fondazione Telethon"
              style={{ height: 40, filter: 'brightness(0) invert(1)', marginBottom: 12, display: 'block', margin: '0 auto 12px' }} />
            <Title level={4} style={{ color: '#fff', margin: '0 0 4px' }}>Valutazione Fornitura</Title>
            <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>
              Ufficio Acquisti · Fondazione Telethon
            </Text>
          </div>
        </Card>

        {/* Info fornitore/ordine */}
        <Card style={{ marginBottom: 20, borderRadius: 14 }}>
          <Row gutter={[16, 12]}>
            <Col xs={24} sm={12}>
              <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Fornitore</Text>
              <div><Text strong style={{ fontSize: 16 }}>{surveyInfo.ragione_sociale}</Text></div>
            </Col>
            {surveyInfo.protocollo_ordine && (
              <Col xs={24} sm={12}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Rif. Ordine</Text>
                <div><Tag color="blue" style={{ fontSize: 13 }}>{surveyInfo.protocollo_ordine}</Tag></div>
              </Col>
            )}
            {surveyInfo.data_ordine && (
              <Col xs={24} sm={12}>
                <Text type="secondary" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Data Ordine</Text>
                <div>
                  <Text>{new Date(surveyInfo.data_ordine).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}</Text>
                </div>
              </Col>
            )}
          </Row>
        </Card>

        {/* Info compilazione */}
        <Alert
          style={{ marginBottom: 20, borderRadius: 10 }}
          type="info"
          message="Come compilare"
          description="Assegna da 1 a 5 stelle per ciascuno dei 3 KPI. Le note sono obbligatorie se la media è inferiore a 3 stelle."
          showIcon
        />

        {/* Media live */}
        {avgRating !== null && (
          <Alert
            style={{ marginBottom: 16, borderRadius: 10 }}
            type={avgRating >= 4 ? 'success' : avgRating >= 2.5 ? 'warning' : 'error'}
            message={
              <Space>
                <span>Media attuale:</span>
                <Rate disabled value={Math.round(avgRating)} count={5} style={{ fontSize: 16 }} />
                <strong>{avgRating.toFixed(1)} / 5 – {STAR_LABELS[Math.round(avgRating) - 1]}</strong>
              </Space>
            }
            showIcon
          />
        )}

        <Form form={form} onFinish={onFinish} layout="vertical">

          {/* 3 KPI */}
          {KPI_LABELS.map((kpi, idx) => {
            const val = ratings[kpi.key]
            return (
              <Card key={kpi.key} style={{ marginBottom: 16, borderRadius: 14 }}>
                <Space align="start" style={{ marginBottom: 12, width: '100%' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 10, flexShrink: 0,
                    background: '#eef2fb', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {kpi.icon}
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 15 }}>
                      KPI {idx + 1} — {kpi.label}
                    </Text>
                    <br />
                    <Text type="secondary" style={{ fontSize: 13 }}>{kpi.description}</Text>
                  </div>
                </Space>

                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingLeft: 56 }}>
                  <Rate
                    count={5}
                    value={val || 0}
                    onChange={(v) => {
                      const newRatings = { ...ratings, [kpi.key]: v || null }
                      setRatings(newRatings)
                      updateAvg(newRatings)
                    }}
                    style={{ fontSize: 34 }}
                    tooltips={STAR_LABELS}
                  />
                  {val ? (
                    <Tag color={val >= 4 ? 'success' : val >= 3 ? 'warning' : 'error'}
                      style={{ fontSize: 13, padding: '2px 10px' }}>
                      {val}/5 — {STAR_LABELS[val - 1]}
                    </Tag>
                  ) : (
                    <Tag>Non valutato</Tag>
                  )}
                </div>
              </Card>
            )
          })}

          {/* Note */}
          <Card style={{ marginBottom: 24, borderRadius: 14 }}>
            <Form.Item
              name="note"
              label={
                <Space>
                  <Text strong>Note e commenti</Text>
                  {avgRating !== null && avgRating < 3
                    ? <Tag color="red">Obbligatorie (media &lt; 3 stelle)</Tag>
                    : <Tag>Opzionali</Tag>
                  }
                </Space>
              }
            >
              <TextArea
                rows={4}
                placeholder="Commenti, osservazioni o segnalazioni sulla fornitura..."
                maxLength={2000}
                showCount
              />
            </Form.Item>
          </Card>

          <Button
            type="primary"
            htmlType="submit"
            loading={submitting}
            block
            size="large"
            disabled={Object.keys(ratings).length === 0}
            style={{
              borderRadius: 10, height: 52, fontSize: 16, fontWeight: 600,
              background: '#1a3a5c', borderColor: '#1a3a5c',
            }}
          >
            ⭐ Invia Valutazione
          </Button>

          <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 20, fontSize: 11 }}>
            🔒 I dati sono trattati nel rispetto del GDPR – Regolamento UE 2016/679.<br />
            Fondazione Telethon – Ufficio Acquisti
          </Paragraph>
        </Form>
      </div>
    </div>
  )
}
