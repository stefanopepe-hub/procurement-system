// ---- Auth ----
export type UserRole = 'super_admin' | 'admin' | 'viewer'

export interface User {
  id: number
  email: string
  username: string
  full_name: string
  role: UserRole
  is_active: boolean
  last_login: string | null
  created_at: string
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: User
}

// ---- Suppliers ----
export type SupplierStatus = 'accreditato' | 'non_piu_accreditato' | 'sotto_osservazione' | 'in_riqualifica'
export type AccreditamentType = 'strategico' | 'preferenziale'
export type LegalPersonType = 'professionista' | 'impresa'
export type SemaforoStatus = 'verde' | 'giallo' | 'rosso' | 'grigio'

export interface SupplierContact {
  id: number
  nome: string | null
  cognome: string | null
  qualifica: string | null
  telefono1: string | null
  telefono2: string | null
  email1: string | null
  email2: string | null
  is_primary: boolean
}

export interface SupplierCertification {
  id: number
  nome: string
  numero: string | null
  ente_rilascio: string | null
  data_rilascio: string | null
  data_scadenza: string | null
  file_path: string | null
}

export interface SupplierDocument {
  id: number
  tipo: string
  nome_file: string
  data_scadenza: string | null
  data_upload: string
}

export interface SupplierFatturato {
  id: number
  anno: number
  fatturato: number | null
}

export interface Communication {
  id: number
  tipo: string
  oggetto: string
  corpo: string | null
  destinatari: string[] | null
  inviata_at: string | null
  is_auto: boolean
  status: string
}

export interface SupplierListItem {
  id: number
  ragione_sociale: string
  alyante_code: string | null
  partita_iva: string | null
  status: SupplierStatus
  accreditament_type: AccreditamentType | null
  data_iscrizione: string | null
  data_riqualifica: string | null
  settore_attivita: string | null
  categorie_merceologiche: string[] | null
  semaforo: SemaforoStatus | null
}

export interface SupplierDetail extends SupplierListItem {
  codice_fiscale: string | null
  legal_person_type: LegalPersonType | null
  totale_ordinato: number | null
  sede_legale_indirizzo: string | null
  sede_legale_comune: string | null
  sede_legale_provincia: string | null
  sede_legale_regione: string | null
  sede_legale_cap: string | null
  sede_legale_nazione: string | null
  sede_legale_web: string | null
  sede_operativa_indirizzo: string | null
  sede_operativa_comune: string | null
  sede_operativa_provincia: string | null
  sede_operativa_regione: string | null
  sede_operativa_cap: string | null
  sede_operativa_nazione: string | null
  sede_operativa_web: string | null
  indirizzo_magazzino: string | null
  maggiori_clienti: string | null
  note_interne: string | null
  contacts: SupplierContact[]
  certifications: SupplierCertification[]
  documents: SupplierDocument[]
  fatturati: SupplierFatturato[]
  communications: Communication[]
  created_at: string | null
  updated_at: string | null
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

// ---- Contracts ----
export type ContractStatus = 'attivo' | 'non_attivo' | 'in_rinegoziazione'
export type EnteStipulante = 'struttura' | 'ricerca' | 'entrambi'

export interface ContractListItem {
  id: number
  id_contratto: string
  ragione_sociale: string
  codice_fornitore: string | null
  status: ContractStatus
  ente_stipulante: EnteStipulante | null
  cdc: string | null
  oggetto: string
  imponibile: number | null
  ivato: number | null
  data_inizio: string | null
  data_scadenza: string | null
  data_rinegoziazione: string | null
  alert_enabled: boolean
  dpa: boolean
  questionario_it_gdpr: boolean
  dpia: boolean
  rinnovo_tacito: boolean
  supplier_id: number | null
}

export interface ContractDetail extends ContractListItem {
  referente_interno: string | null
  referente_ufficio_acquisti: string | null
  riferimento_gara: string | null
  cig_cup_commessa: string | null
  recesso_anticipato: string | null
  ordini_alyante: string[] | null
  documents: SupplierDocument[]
  communications: Communication[]
  created_at: string | null
  updated_at: string | null
}

// ---- Vendor Rating ----
export interface RatingDetail {
  id: number
  supplier_id: number
  ragione_sociale: string | null
  protocollo_ordine: string | null
  numero_pubblicazione: string | null
  tipo_trigger: string
  data_ordine: string | null
  data_registrazione: string | null
  data_valutazione: string | null
  valutatore_nome: string | null
  valutatore_email: string | null
  cdc_commessa: string | null
  responsabile: string | null
  kpi1_qualita_prezzo: number | null
  kpi2_qualita_relazionale: number | null
  kpi3_qualita_tecnica: number | null
  kpi4_affidabilita_tempi: number | null
  kpi5_puntualita_consegna: number | null
  kpi6_precisione_fornitura: number | null
  kpi7_non_conformita: number | null
  media_kpi_utente: number | null
  media_generale: number | null
  semaforo: SemaforoStatus
  note: string | null
  note_acquisti: string | null
}

export interface SupplierRatingSummary {
  supplier_id: number
  ragione_sociale: string
  total_ratings: number
  media_kpi1: number | null
  media_kpi2: number | null
  media_kpi3: number | null
  media_kpi4: number | null
  media_kpi5: number | null
  media_kpi6: number | null
  media_kpi7: number | null
  media_generale: number | null
  semaforo: SemaforoStatus
}
