import React, { useState, useEffect } from 'react'
import {
  Form, Input, Select, DatePicker, Button, Card, Row, Col, Typography,
  Space, Divider, Table, message, Popconfirm, InputNumber, Tag
} from 'antd'
import { PlusOutlined, DeleteOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'
import { useNavigate, useParams } from 'react-router-dom'
import dayjs from 'dayjs'
import { suppliersApi } from '../../services/api'
import type { SupplierDetail, SupplierContact, SupplierCertification, SupplierFatturato } from '../../types'

const { Title } = Typography
const { Option } = Select
const { TextArea } = Input

const CATEGORIES = [
  'Informatica e Tecnologia', 'Materiale Laboratorio', 'Materiale d\'Ufficio',
  'Consulenza', 'Manutenzione', 'Logistica', 'Servizi Professionali',
  'Farmaceutico', 'Pulizie e Facility', 'Formazione', 'Altro',
]

export const SupplierForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = Boolean(id)

  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [supplier, setSupplier] = useState<SupplierDetail | null>(null)

  // Local state for sub-tables
  const [contacts, setContacts] = useState<Partial<SupplierContact>[]>([])
  const [certifications, setCertifications] = useState<Partial<SupplierCertification>[]>([])
  const [fatturati, setFatturati] = useState<Partial<SupplierFatturato>[]>([{ anno: new Date().getFullYear() - 1 }])

  useEffect(() => {
    if (isEdit) {
      setLoading(true)
      suppliersApi.get(Number(id)).then((res) => {
        const s: SupplierDetail = res.data
        setSupplier(s)
        form.setFieldsValue({
          ...s,
          data_iscrizione: s.data_iscrizione ? dayjs(s.data_iscrizione) : undefined,
          data_riqualifica: s.data_riqualifica ? dayjs(s.data_riqualifica) : undefined,
        })
        setContacts(s.contacts || [])
        setCertifications(s.certifications || [])
        setFatturati(s.fatturati?.length ? s.fatturati : [{ anno: new Date().getFullYear() - 1 }])
      }).catch(() => {
        message.error('Fornitore non trovato')
        navigate('/suppliers')
      }).finally(() => setLoading(false))
    }
  }, [id])

  const onFinish = async (values: any) => {
    setSaving(true)
    try {
      const payload = {
        ...values,
        data_riqualifica: values.data_riqualifica?.format('YYYY-MM-DD'),
      }
      delete payload.data_iscrizione // non modificabile

      let supplierId = Number(id)
      if (isEdit) {
        await suppliersApi.update(supplierId, payload)
      } else {
        const res = await suppliersApi.create(payload)
        supplierId = res.data.id
      }

      // Save contacts
      for (const c of contacts) {
        if (c.id) {
          await suppliersApi.updateContact(supplierId, c.id, c)
        } else if (c.nome || c.cognome || c.email1) {
          await suppliersApi.addContact(supplierId, c)
        }
      }

      // Save certifications (new ones only)
      for (const cert of certifications) {
        if (!cert.id && cert.nome) {
          const certPayload = { ...cert }
          delete certPayload.id
          await suppliersApi.addCertification(supplierId, certPayload)
        }
      }

      // Save fatturati (new ones only)
      for (const fat of fatturati) {
        if (!fat.id && fat.anno) {
          await suppliersApi.addFatturato(supplierId, { anno: fat.anno, fatturato: fat.fatturato })
        }
      }

      message.success(isEdit ? 'Fornitore aggiornato' : 'Fornitore creato')
      navigate(`/suppliers/${supplierId}`)
    } catch (err: any) {
      message.error(err.response?.data?.detail || 'Errore nel salvataggio')
    } finally {
      setSaving(false)
    }
  }

  const addContact = () => setContacts([...contacts, { is_primary: false }])
  const removeContact = (idx: number) => setContacts(contacts.filter((_, i) => i !== idx))
  const updateContact = (idx: number, field: string, value: any) => {
    const updated = [...contacts]
    updated[idx] = { ...updated[idx], [field]: value }
    setContacts(updated)
  }

  const addCert = () => setCertifications([...certifications, {}])
  const removeCert = (idx: number) => setCertifications(certifications.filter((_, i) => i !== idx))
  const updateCert = (idx: number, field: string, value: any) => {
    const updated = [...certifications]
    updated[idx] = { ...updated[idx], [field]: value }
    setCertifications(updated)
  }

  const addFatturato = () => setFatturati([...fatturati, { anno: new Date().getFullYear() - 1 }])
  const removeFatturato = (idx: number) => setFatturati(fatturati.filter((_, i) => i !== idx))
  const updateFatturato = (idx: number, field: string, value: any) => {
    const updated = [...fatturati]
    updated[idx] = { ...updated[idx], [field]: value }
    setFatturati(updated)
  }

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
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(isEdit ? `/suppliers/${id}` : '/suppliers')}>
            {isEdit ? 'Torna al fornitore' : 'Albo Fornitori'}
          </Button>
          <Title level={4} style={{ margin: 0 }}>{isEdit ? 'Modifica Fornitore' : 'Nuovo Fornitore'}</Title>
        </Space>
        <Button type="primary" icon={<SaveOutlined />} size="large" loading={saving}
          onClick={() => form.submit()}>
          {isEdit ? 'Salva Modifiche' : 'Crea Fornitore'}
        </Button>
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish}>

        {/* ── Dati anagrafici (da Alyante) ── */}
        <Card title="Dati Anagrafici" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="ragione_sociale" label="Ragione Sociale" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="alyante_code" label="Codice Fornitore (Alyante)">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="legal_person_type" label="Personalità Giuridica">
                <Select allowClear>
                  <Option value="impresa">Impresa</Option>
                  <Option value="professionista">Professionista</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="partita_iva" label="P.IVA">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="codice_fiscale" label="Codice Fiscale">
                <Input />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Sede Legale ── */}
        <Card title="Sede Legale" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={10}><Form.Item name="sede_legale_indirizzo" label="Indirizzo"><Input /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="sede_legale_comune" label="Comune"><Input /></Form.Item></Col>
            <Col xs={24} md={3}><Form.Item name="sede_legale_provincia" label="Prov."><Input maxLength={5} /></Form.Item></Col>
            <Col xs={24} md={5}><Form.Item name="sede_legale_regione" label="Regione"><Input /></Form.Item></Col>
            <Col xs={24} md={3}><Form.Item name="sede_legale_cap" label="CAP"><Input /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="sede_legale_nazione" label="Nazione"><Input defaultValue="Italia" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="sede_legale_web" label="Sito Web"><Input /></Form.Item></Col>
          </Row>
        </Card>

        {/* ── Sede Operativa ── */}
        <Card title="Sede Operativa" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col xs={24} md={10}><Form.Item name="sede_operativa_indirizzo" label="Indirizzo"><Input /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="sede_operativa_comune" label="Comune"><Input /></Form.Item></Col>
            <Col xs={24} md={3}><Form.Item name="sede_operativa_provincia" label="Prov."><Input maxLength={5} /></Form.Item></Col>
            <Col xs={24} md={3}><Form.Item name="sede_operativa_cap" label="CAP"><Input /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="sede_operativa_nazione" label="Nazione"><Input /></Form.Item></Col>
          </Row>
        </Card>

        {/* ── Qualifica Albo ── */}
        <Card title="Qualifica nell'Albo" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            {isEdit && (
              <Col xs={24} md={6}>
                <Form.Item label="Data Iscrizione">
                  <Input
                    value={supplier?.data_iscrizione ? new Date(supplier.data_iscrizione).toLocaleDateString('it-IT') : '—'}
                    disabled
                  />
                </Form.Item>
              </Col>
            )}
            <Col xs={24} md={6}>
              <Form.Item name="data_riqualifica" label="Data Riqualifica">
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="status" label="Stato">
                <Select allowClear>
                  <Option value="accreditato">Accreditato</Option>
                  <Option value="non_piu_accreditato">Non più accreditato</Option>
                  <Option value="sotto_osservazione">Sotto Osservazione</Option>
                  <Option value="in_riqualifica">In Riqualifica</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="accreditament_type" label="Tipo Accreditamento">
                <Select allowClear>
                  <Option value="strategico">Strategico (riqualifica ogni 54 mesi)</Option>
                  <Option value="preferenziale">Preferenziale (riqualifica ogni 30 mesi)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="settore_attivita" label="Settore di Attività">
                <Input />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="categorie_merceologiche" label="Categorie Merceologiche">
                <Select mode="multiple" allowClear placeholder="Seleziona categorie">
                  {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="maggiori_clienti" label="Maggiori Clienti">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="note_interne" label="Note Interne">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* ── Referenti ── */}
        <Card
          title="Referenti / Contatti"
          style={{ marginBottom: 16 }}
          extra={<Button icon={<PlusOutlined />} size="small" onClick={addContact}>Aggiungi</Button>}
        >
          {contacts.map((c, idx) => (
            <div key={idx} style={{ border: '1px solid #f0f0f0', borderRadius: 6, padding: 12, marginBottom: 8 }}>
              <Row gutter={8}>
                <Col xs={12} md={4}><Input placeholder="Nome" value={c.nome || ''} onChange={e => updateContact(idx, 'nome', e.target.value)} /></Col>
                <Col xs={12} md={4}><Input placeholder="Cognome" value={c.cognome || ''} onChange={e => updateContact(idx, 'cognome', e.target.value)} /></Col>
                <Col xs={24} md={4}><Input placeholder="Qualifica" value={c.qualifica || ''} onChange={e => updateContact(idx, 'qualifica', e.target.value)} /></Col>
                <Col xs={12} md={4}><Input placeholder="Telefono 1" value={c.telefono1 || ''} onChange={e => updateContact(idx, 'telefono1', e.target.value)} /></Col>
                <Col xs={12} md={4}><Input placeholder="Email 1" value={c.email1 || ''} onChange={e => updateContact(idx, 'email1', e.target.value)} /></Col>
                <Col xs={12} md={3}><Input placeholder="Email 2" value={c.email2 || ''} onChange={e => updateContact(idx, 'email2', e.target.value)} /></Col>
                <Col xs={12} md={1} style={{ textAlign: 'center', paddingTop: 4 }}>
                  <Popconfirm title="Rimuovere questo contatto?" onConfirm={() => removeContact(idx)}>
                    <Button icon={<DeleteOutlined />} size="small" danger type="text" />
                  </Popconfirm>
                </Col>
              </Row>
            </div>
          ))}
          {contacts.length === 0 && <p style={{ color: '#888', textAlign: 'center' }}>Nessun referente aggiunto</p>}
        </Card>

        {/* ── Certificazioni ── */}
        <Card
          title="Certificazioni e Attestati"
          style={{ marginBottom: 16 }}
          extra={<Button icon={<PlusOutlined />} size="small" onClick={addCert}>Aggiungi</Button>}
        >
          {certifications.map((cert, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={24} md={6}><Input placeholder="Nome cert. (es. ISO 9001)" value={cert.nome || ''} onChange={e => updateCert(idx, 'nome', e.target.value)} /></Col>
              <Col xs={24} md={4}><Input placeholder="Numero" value={cert.numero || ''} onChange={e => updateCert(idx, 'numero', e.target.value)} /></Col>
              <Col xs={24} md={5}><Input placeholder="Ente di rilascio" value={cert.ente_rilascio || ''} onChange={e => updateCert(idx, 'ente_rilascio', e.target.value)} /></Col>
              <Col xs={12} md={4}>
                <DatePicker placeholder="Scadenza" style={{ width: '100%' }} format="DD/MM/YYYY"
                  value={cert.data_scadenza ? dayjs(cert.data_scadenza) : undefined}
                  onChange={d => updateCert(idx, 'data_scadenza', d?.format('YYYY-MM-DD'))} />
              </Col>
              <Col xs={12} md={1}>
                <Popconfirm title="Rimuovere?" onConfirm={() => removeCert(idx)}>
                  <Button icon={<DeleteOutlined />} size="small" danger type="text" />
                </Popconfirm>
              </Col>
            </Row>
          ))}
        </Card>

        {/* ── Fatturato ── */}
        <Card
          title="Fatturato Ultimi 3 Anni"
          style={{ marginBottom: 16 }}
          extra={<Button icon={<PlusOutlined />} size="small" onClick={addFatturato}>Aggiungi anno</Button>}
        >
          {fatturati.map((fat, idx) => (
            <Row key={idx} gutter={8} style={{ marginBottom: 8 }}>
              <Col xs={12} md={4}>
                <InputNumber placeholder="Anno" style={{ width: '100%' }} value={fat.anno}
                  onChange={v => updateFatturato(idx, 'anno', v)} min={2000} max={2099} />
              </Col>
              <Col xs={12} md={6}>
                <InputNumber placeholder="Fatturato €" style={{ width: '100%' }} value={fat.fatturato as number}
                  formatter={v => `€ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  onChange={v => updateFatturato(idx, 'fatturato', v)} />
              </Col>
              <Col xs={4} md={1}>
                <Button icon={<DeleteOutlined />} size="small" danger type="text" onClick={() => removeFatturato(idx)} />
              </Col>
            </Row>
          ))}
        </Card>

        <Space>
          <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
            {isEdit ? 'Salva Modifiche' : 'Crea Fornitore'}
          </Button>
          <Button onClick={() => navigate(isEdit ? `/suppliers/${id}` : '/suppliers')}>Annulla</Button>
        </Space>
      </Form>
    </div>
  )
}
