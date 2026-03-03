import React, { useState, useEffect } from 'react'
import {
  Card, Rate, Button, Form, Input, Alert, Typography, Space, Spin,
  Result, Divider, Row, Col, Tag
} from 'antd'
import { CheckCircleOutlined, CloseCircleOutlined, StarOutlined } from '@ant-design/icons'
import { useParams } from 'react-router-dom'
import { vendorRatingApi } from '../../services/api'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input

const KPI_LABELS = [
  { key: 'kpi1_qualita_prezzo', label: 'Qualità prezzo / fornitura', description: 'Il rapporto qualità/prezzo della fornitura è stato adeguato?' },
  { key: 'kpi2_qualita_relazionale', label: 'Qualità relazionale del fornitore', description: 'Come valuta il rapporto con il personale del fornitore?' },
  { key: 'kpi3_qualita_tecnica', label: 'Qualità tecnica della fornitura', description: 'La fornitura ha rispettato le specifiche tecniche richieste?' },
  { key: 'kpi4_affidabilita_tempi', label: 'Affidabilità rispetto ai tempi di consegna', description: 'Il fornitore ha rispettato le tempistiche concordate?' },
]

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
        ...values,
        kpi1_qualita_prezzo: ratings.kpi1_qualita_prezzo || null,
        kpi2_qualita_relazionale: ratings.kpi2_qualita_relazionale || null,
        kpi3_qualita_tecnica: ratings.kpi3_qualita_tecnica || null,
        kpi4_affidabilita_tempi: ratings.kpi4_affidabilita_tempi || null,
      })
      setSubmitted(true)
    } catch (err: any) {
      const detail = err.response?.data?.detail
      if (detail === 'Note are required when rating is below 3 (insufficient)') {
        form.setFields([{ name: 'note', errors: ['Le note sono obbligatorie per valutazioni sotto la sufficienza (< 3)'] }])
      } else {
        form.setFields([{ name: 'note', errors: [detail || 'Errore durante l\'invio'] }])
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" />
    </div>
  )

  if (!surveyInfo) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Result status="404" title="Valutazione non trovata" subTitle="Il link non è valido." />
    </div>
  )

  if (surveyInfo.is_expired) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Result
        icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
        status="error"
        title="Valutazione scaduta"
        subTitle="Il link per la valutazione è scaduto (limite: 30 giorni dall'invio)."
      />
    </div>
  )

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5' }}>
      <Result
        icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
        status="success"
        title="Grazie per la tua valutazione!"
        subTitle="La tua valutazione è stata registrata con successo. Contribuisce a migliorare la qualità delle nostre forniture."
      />
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5f5', padding: '40px 16px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
        {/* Header */}
        <Card style={{ marginBottom: 24, textAlign: 'center', borderRadius: 12 }}>
          <StarOutlined style={{ fontSize: 40, color: '#1677ff', marginBottom: 8 }} />
          <Title level={3} style={{ marginBottom: 4 }}>Valutazione Fornitura</Title>
          <Text type="secondary">Fondazione Telethon – Ufficio Acquisti</Text>
        </Card>

        {/* Supplier info */}
        <Card style={{ marginBottom: 24, borderRadius: 12 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Text type="secondary">Fornitore</Text>
              <div><Text strong style={{ fontSize: 16 }}>{surveyInfo.ragione_sociale}</Text></div>
            </Col>
            <Col span={12}>
              <Text type="secondary">Riferimento Ordine</Text>
              <div><Tag>{surveyInfo.protocollo_ordine || '—'}</Tag></div>
            </Col>
            {surveyInfo.data_ordine && (
              <Col span={12} style={{ marginTop: 8 }}>
                <Text type="secondary">Data Ordine</Text>
                <div><Text>{new Date(surveyInfo.data_ordine).toLocaleDateString('it-IT')}</Text></div>
              </Col>
            )}
          </Row>
        </Card>

        {/* Average preview */}
        {avgRating !== null && (
          <Alert
            style={{ marginBottom: 16, borderRadius: 12 }}
            type={avgRating >= 4 ? 'success' : avgRating >= 2.5 ? 'warning' : 'error'}
            message={`Media corrente: ${avgRating.toFixed(1)} / 5`}
            showIcon
          />
        )}

        <Form form={form} onFinish={onFinish} layout="vertical">
          {/* KPI ratings */}
          {KPI_LABELS.map((kpi) => (
            <Card key={kpi.key} style={{ marginBottom: 16, borderRadius: 12 }}>
              <div style={{ marginBottom: 8 }}>
                <Text strong>{kpi.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 13 }}>{kpi.description}</Text>
              </div>
              <Rate
                count={5}
                value={ratings[kpi.key] || 0}
                onChange={(val) => {
                  const newRatings = { ...ratings, [kpi.key]: val || null }
                  setRatings(newRatings)
                  updateAvg(newRatings)
                }}
                style={{ fontSize: 28 }}
                character={<StarOutlined />}
              />
              {ratings[kpi.key] && (
                <Tag color="blue" style={{ marginLeft: 12 }}>{ratings[kpi.key]}/5</Tag>
              )}
            </Card>
          ))}

          {/* Notes */}
          <Card style={{ marginBottom: 24, borderRadius: 12 }}>
            <Form.Item
              name="note"
              label={
                <span>
                  Note {avgRating !== null && avgRating < 3 && <Tag color="red">Obbligatorie</Tag>}
                </span>
              }
            >
              <TextArea
                rows={4}
                placeholder="Inserire eventuali commenti, osservazioni o segnalazioni..."
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
            style={{ borderRadius: 8, height: 48 }}
          >
            Invia Valutazione
          </Button>
        </Form>

        <Paragraph type="secondary" style={{ textAlign: 'center', marginTop: 24, fontSize: 12 }}>
          Questa valutazione è riservata a uso interno di Fondazione Telethon.
          I dati sono trattati nel rispetto del GDPR.
        </Paragraph>
      </div>
    </div>
  )
}
