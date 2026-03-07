# Piano UAT — Procurement System Fondazione Telethon
**Versione:** 1.0 | **Data:** Marzo 2026 | **Ambiente:** Beta/Staging

---

## Credenziali di Accesso

| Ruolo | Username | Password | Permessi |
|-------|----------|----------|----------|
| Super Admin | `admin` | `Admin123456!` | Tutto + gestione utenti + audit log |
| Admin Ufficio | `admin_ufficio` | `Admin2024!Tlt` | Lettura/scrittura su tutto |
| Admin Ricerca | `admin_ricerca` | `Admin2024!Tlt` | Lettura/scrittura su tutto |
| Viewer | `viewer_luigi` | `Viewer2024!Tlt` | Solo lettura Albo Fornitori |

> **Nota:** Dopo il seed, il database contiene 20 fornitori, 60 contratti, ~120 valutazioni, non conformità e valutazioni UA.

---

## Scenari UAT

---

### TS-01 | Autenticazione e Sicurezza
**Ruolo:** Qualsiasi | **Priorità:** 🔴 CRITICO

| # | Passo | Dato di input | Risultato atteso | Esito |
|---|-------|--------------|-----------------|-------|
| 1.1 | Aprire `/login` | — | Form login visibile con logo | ☐ |
| 1.2 | Login con credenziali errate | `admin` / `password_errata` | Messaggio errore "Credenziali non valide" | ☐ |
| 1.3 | Ripetere login errato 5 volte | — | "Account temporaneamente bloccato (15 min)" | ☐ |
| 1.4 | Login corretto come Admin | `admin_ufficio` / `Admin2024!Tlt` | Redirect a Dashboard, menu Admin visibile | ☐ |
| 1.5 | Login come Viewer | `viewer_luigi` / `Viewer2024!Tlt` | Redirect a Albo Fornitori, menu limitato (no Contratti, no Vendor Rating) | ☐ |
| 1.6 | Tentare accesso diretto a `/contracts` come Viewer | URL diretto | Redirect a login O accesso negato | ☐ |
| 1.7 | Logout | Pulsante utente → Esci | Redirect a login, token invalidato | ☐ |
| 1.8 | Cambio password | Menu utente → Cambia password | Nuova password accettata se rispetta policy NIS2 (min 12 char, maiuscola, minuscola, numero, speciale) | ☐ |

---

### TS-02 | Dashboard
**Ruolo:** Admin | **Priorità:** 🔴 CRITICO

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 2.1 | Accedere alla Dashboard | 4 KPI card visibili: Fornitori Attivi, Contratti Attivi, In Scadenza 60gg, Valutazioni Pending | ☐ |
| 2.2 | Verificare contatori | Fornitori ≥ 20, Contratti ≥ 60, Scadenze > 0 | ☐ |
| 2.3 | Alert contratti in scadenza | Lista contratti con ≤60 giorni visibile con badge colorato (rosso <30gg, arancio 30-60gg) | ☐ |
| 2.4 | Grafico stati contratti | Barre progress per Attivi / Non Attivi / In Rinegoziazione | ☐ |
| 2.5 | Grafico semafori fornitori | Conteggio Verde / Giallo / Rosso / Grigio | ☐ |
| 2.6 | Audit log (solo Super Admin) | Timeline ultimi eventi di sistema | ☐ |
| 2.7 | Pulsante "Verifica Scadenze" | Alert di conferma: job schedulato eseguito | ☐ |
| 2.8 | Clic su KPI "In Scadenza" | Navigazione a /contracts con filtri preimpostati | ☐ |

---

### TS-03 | Gestione Fornitori (Albo)
**Ruolo:** Admin (creazione/modifica), Viewer (solo lettura) | **Priorità:** 🔴 CRITICO

| # | Passo | Dato di input | Risultato atteso | Esito |
|---|-------|--------------|-----------------|-------|
| 3.1 | Accedere ad Albo Fornitori | — | Lista 20 fornitori con colonne: Semaforo, Ragione Sociale, P.IVA, Stato, Tipo, Settore | ☐ |
| 3.2 | Ricerca per nome | `"Acme"` | Lista filtrata: solo "Acme Informatica SRL" | ☐ |
| 3.3 | Filtro per stato | `Accreditato` | Lista solo fornitori accreditati | ☐ |
| 3.4 | Filtro per tipo | `Strategico` | Lista solo fornitori strategici | ☐ |
| 3.5 | Export CSV | Pulsante Export | File CSV scaricato con tutti i fornitori | ☐ |
| 3.6 | **Crea nuovo fornitore** | Ragione Sociale: "Test SpA", P.IVA: "99988877766", Cod.Alyante: "ALY099", Tipo: Preferenziale | Fornitore salvato, visibile in lista | ☐ |
| 3.7 | Aprire dettaglio fornitore | Click su "Acme Informatica SRL" | Tabs: Anagrafica, Qualifica, Ordini, Contratti, Comunicazioni | ☐ |
| 3.8 | Verifica dati anagrafica | — | Dati completi: sede legale, referenti, fatturato anni precedenti | ☐ |
| 3.9 | Tab Qualifica | — | Stato accreditamento, certificazioni con alert scadenze, documenti | ☐ |
| 3.10 | Upload documento fornitore | File PDF < 50MB | Documento salvato, visibile in lista con tipo e data | ☐ |
| 3.11 | Modifica fornitore | Cambia "Note Interne" | Modifica salvata con successo | ☐ |
| 3.12 | Semaforo colorato | — | Almeno 3 fornitori con semaforo VERDE, 2 con GIALLO | ☐ |
| 3.13 | Viewer: tentare creazione fornitore | — | Pulsante "Nuovo" non visibile | ☐ |

---

### TS-04 | Gestione Contratti
**Ruolo:** Admin | **Priorità:** 🔴 CRITICO

| # | Passo | Dato di input | Risultato atteso | Esito |
|---|-------|--------------|-----------------|-------|
| 4.1 | Accedere al Database Contratti | — | Lista 60 contratti con colori riga (rosso/arancio per scadenze) | ☐ |
| 4.2 | Filtro per stato | `Attivo` | Solo contratti attivi (35) | ☐ |
| 4.3 | Filtro per data scadenza | Range: oggi → +30 giorni | Contratti in scadenza imminente (8) | ☐ |
| 4.4 | Filtro GDPR | Checkbox DPA | Solo contratti con DPA = Sì | ☐ |
| 4.5 | Export CSV contratti | Pulsante Export | File CSV con tutti i contratti | ☐ |
| 4.6 | **Crea nuovo contratto** | Fornitore: "Acme Informatica", Oggetto: "Servizi IT Test", Imponibile: 50000, IVA: 22%, Scadenza: +180gg | Contratto salvato con ID auto-generato (CTR-00061) | ☐ |
| 4.7 | Verifica calcolo IVA | Imponibile: 10.000, IVA: 22% | Ivato: 12.200 calcolato automaticamente | ☐ |
| 4.8 | Aprire dettaglio contratto | Click su CTR-00001 | Tabs: Dati, Ordini, Documenti, Comunicazioni, Analisi AI | ☐ |
| 4.9 | Upload documento contratto | File PDF | Documento salvato, visibile in Tab Documenti | ☐ |
| 4.10 | Alert scadenza visivo | Contratto con scadenza < 30gg | ExpiryTag rosso con "X giorni" | ☐ |
| 4.11 | Toggle alert email | Switch "Abilita Alert" | Stato cambiato | ☐ |
| 4.12 | Contratto con DPA + GDPR + DPIA | — | Badge colorati visibili in lista | ☐ |

---

### TS-05 | Analisi AI Contratti (se ANTHROPIC_API_KEY configurata)
**Ruolo:** Admin | **Priorità:** 🟡 OPZIONALE

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 5.1 | Aprire dettaglio contratto con PDF caricato | Tab "Analisi AI" visibile | ☐ |
| 5.2 | Selezionare PDF dal dropdown | Lista documenti PDF disponibili | ☐ |
| 5.3 | Avviare analisi | Loading ~15-30 secondi | ☐ |
| 5.4 | Risultato analisi | Punteggio conformità 0-100, livello rischio, clausole standard check/cross, criticità evidenziate, raccomandazioni | ☐ |

---

### TS-06 | Vendor Rating — Flusso Completo
**Ruolo:** Admin + Utente esterno (email) | **Priorità:** 🔴 CRITICO

#### 6A. Dashboard Vendor Rating
| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 6A.1 | Accedere a /vendor-rating | Lista fornitori con semaforo, media generale, KPI bars | ☐ |
| 6A.2 | Filtro per semaforo VERDE | Solo fornitori con media ≥ 4.0 | ☐ |
| 6A.3 | Clic su fornitore | Dettaglio con tab "Valutazioni Utente" e "Valutazione Annuale UA" | ☐ |
| 6A.4 | Tab Valutazioni Utente | Tabella con KPI 1-7, note, semaforo per ogni ordine | ☐ |
| 6A.5 | Tab UA | Form anno corrente con 6 KPI (Rate 1-5) | ☐ |
| 6A.6 | Inserire valutazione UA | Compilare 6 KPI + note | Valutazione salvata, media aggiornata | ☐ |

#### 6B. Flusso Webhook → Survey
| # | Passo | Dato di input | Risultato atteso | Esito |
|---|-------|--------------|-----------------|-------|
| 6B.1 | Invocare webhook Alyante | `POST /api/v1/vendor-rating/webhook/alyante` con codice fornitore ALY001 | HTTP 202, survey token generato | ☐ |
| 6B.2 | Aprire URL survey | `/survey/{token}` | Pagina pubblica con dati ordine, form 4 KPI | ☐ |
| 6B.3 | Compilare survey | KPI1=4, KPI2=5, KPI3=4, KPI4=3 | — | ☐ |
| 6B.4 | Submit senza note con media < 3 | Media = 2.0 | Errore: "Le note sono obbligatorie per valutazioni sotto 3" | ☐ |
| 6B.5 | Submit con note | Media = 4.5 + note | Pagina "Grazie! Valutazione registrata" | ☐ |
| 6B.6 | Tentare di riaprire la stessa survey | URL token già usato | Messaggio "Survey già completata" | ☐ |
| 6B.7 | Verificare aggiornamento semaforo | Dashboard vendor rating | Semaforo aggiornato per ALY001 | ☐ |

#### 6C. Webhook Fornitore Non Trovato
| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 6C.1 | Webhook con codice fornitore inesistente | `codice_fornitore: "ALY_INESISTENTE"` | HTTP 422 "Fornitore non presente nell'Albo" (NON crash FK) | ☐ |

---

### TS-07 | Non Conformità
**Ruolo:** Admin | **Priorità:** 🟡 IMPORTANTE

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 7.1 | Accedere a /non-conformita | Lista non conformità con colori stato (rosso=aperta, arancio=in lavorazione, verde=chiusa) | ☐ |
| 7.2 | Filtro per fornitore | Select fornitore → lista filtrata | ☐ |
| 7.3 | Filtro per stato "Aperta" | Solo NC aperte | ☐ |
| 7.4 | Invocare webhook NC | `POST /api/v1/vendor-rating/webhook/non-conformita` con dati | NC creata, visibile in lista | ☐ |
| 7.5 | Verifica impatto su KPI7 | Valutazione fornitore con NC aperte | KPI7 (Non Conformità) riflette il conteggio NC aperte | ☐ |

---

### TS-08 | GDPR Compliance
**Ruolo:** Admin/Super Admin | **Priorità:** 🟡 IMPORTANTE

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 8.1 | Accedere a /gdpr/registro | Tabella Registro Trattamenti con 5 trattamenti (GDPR Art.30) | ☐ |
| 8.2 | Verificare dati registro | Finalità, base giuridica, periodo conservazione per ogni trattamento | ☐ |
| 8.3 | Accedere a /gdpr/diritto-oblio | Form richiesta diritto all'oblio/rettifica/portabilità | ☐ |
| 8.4 | Compilare form richiesta | Nome, email valida, tipo "Cancellazione dati", descrizione | Form inviato, messaggio conferma | ☐ |

---

### TS-09 | Pannello Amministrazione
**Ruolo:** Super Admin | **Priorità:** 🟡 IMPORTANTE

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 9.1 | Accedere a /admin | KPI sistema: totale fornitori, contratti, documenti, utenti | ☐ |
| 9.2 | Tab Utenti | Lista tutti gli utenti con ruolo e stato | ☐ |
| 9.3 | Cambiare ruolo utente | Select ruolo da VIEWER a ADMIN per viewer_luigi | Ruolo aggiornato | ☐ |
| 9.4 | Disattivare utente | Toggle "Attivo" su viewer_anna | Utente disattivato, non può più loggarsi | ☐ |
| 9.5 | Tab Audit Log | Ultimi 50 eventi con: utente, azione, risorsa, IP, timestamp | ☐ |
| 9.6 | Crea nuovo utente | Username: test_nuovo, email: test@telethon.it, password NIS2-compliant | Utente creato, visibile in lista | ☐ |

---

### TS-10 | Notifiche Email Scheduler
**Ruolo:** Sistema | **Priorità:** 🟡 IMPORTANTE (richiede SMTP)

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 10.1 | Trigger manuale check scadenze | `POST /api/v1/admin/check-expiries` | Job eseguito, email inviate per contratti in scadenza | ☐ |
| 10.2 | Verifica log comunicazioni | Dettaglio contratto → Tab Comunicazioni | Comunicazioni automatiche visibili (notifica_60gg, notifica_30gg) | ☐ |
| 10.3 | Email survey vendor rating | Webhook Alyante con email valida | Email ricevuta con link survey | ☐ |

---

### TS-11 | Performance e Stabilità
**Ruolo:** Admin | **Priorità:** 🟡 IMPORTANTE

| # | Passo | Risultato atteso | Esito |
|---|-------|-----------------|-------|
| 11.1 | Caricare Dashboard con 60+ contratti | < 3 secondi di caricamento | ☐ |
| 11.2 | Lista fornitori (20 records) | Rendering tabella < 1 secondo | ☐ |
| 11.3 | Ricerca fornitori in ContractForm | Debounce 400ms, no chiamate API ad ogni tasto | ☐ |
| 11.4 | Aprire dettaglio rating fornitore | Summary caricata da endpoint dedicato (non page_size=999) | ☐ |
| 11.5 | Upload file 10MB | Upload completato, file accessibile | ☐ |
| 11.6 | Sessione scaduta (30 min idle) | Auto-refresh token silenzioso, se fallisce → redirect login | ☐ |

---

## Checklist Pre-Avvio Test

```
[ ] Backend avviato e raggiungibile su /api/v1/health
[ ] Database PostgreSQL connesso
[ ] Seed eseguito: python seed.py
[ ] Super Admin creato: python create_admin.py (o via bootstrap)
[ ] Frontend accessibile su porta 80
[ ] Configurazione CORS corretta per dominio di test
```

---

## Bug Report Template

Per ogni anomalia riscontrata, documentare:

| Campo | Valore |
|-------|--------|
| ID Test | TS-XX.Y |
| Titolo | Breve descrizione |
| Passi per riprodurre | 1. 2. 3. |
| Risultato ottenuto | ... |
| Risultato atteso | ... |
| Gravità | 🔴 Bloccante / 🟡 Importante / 🟢 Minore |
| Screenshot | allegato |
| Browser/OS | Chrome 121 / macOS |

---

## Riepilogo Scenari

| Scenario | Priorità | Test | Esiti |
|----------|----------|------|-------|
| TS-01 Autenticazione | 🔴 CRITICO | 8 | ☐ |
| TS-02 Dashboard | 🔴 CRITICO | 8 | ☐ |
| TS-03 Fornitori | 🔴 CRITICO | 13 | ☐ |
| TS-04 Contratti | 🔴 CRITICO | 12 | ☐ |
| TS-05 AI Analysis | 🟡 OPZIONALE | 4 | ☐ |
| TS-06 Vendor Rating | 🔴 CRITICO | 13 | ☐ |
| TS-07 Non Conformità | 🟡 IMPORTANTE | 5 | ☐ |
| TS-08 GDPR | 🟡 IMPORTANTE | 4 | ☐ |
| TS-09 Admin Panel | 🟡 IMPORTANTE | 6 | ☐ |
| TS-10 Email | 🟡 IMPORTANTE | 3 | ☐ |
| TS-11 Performance | 🟡 IMPORTANTE | 6 | ☐ |
| **TOTALE** | | **82** | |

---

## Criteri di Accettazione Go-Live

Il sistema è pronto per il go-live quando:
- ✅ Tutti i test **🔴 CRITICO** superati senza bug bloccanti
- ✅ Nessun errore 500 nei log durante i test UAT
- ✅ Export CSV funzionante per fornitori e contratti
- ✅ Flusso survey vendor rating end-to-end verificato
- ✅ Login / logout / gestione sessioni verificati
- ✅ Almeno 1 email test ricevuta (se SMTP configurato)
