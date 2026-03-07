# Checklist Go-Live — Procurement System
### Fondazione Telethon · Ufficio Acquisti

---

## Legenda
- ✅ Fatto e verificato
- ⚠️ Fatto ma da configurare in produzione
- ❌ Mancante / da fare
- 🔧 Tecnico (richiede sviluppatore)

---

## 1. SICUREZZA

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 1.1 | Autenticazione JWT | ✅ | Token 30 min, refresh 7 giorni |
| 1.2 | Password forti (NIS2) | ✅ | Min 12 car, upper+lower+digit+special |
| 1.3 | Blocco account dopo 5 tentativi | ✅ | 15 min di lockout |
| 1.4 | HTTPS forzato in produzione | ✅ | HSTS header attivo |
| 1.5 | Token survey monouso | ✅ | HTTP 409 se già compilata |
| 1.6 | Token survey con scadenza 30gg | ✅ | HTTP 410 se scaduta |
| 1.7 | Token survey sicuro (96 char) | ✅ | secrets.token_urlsafe(64) |
| 1.8 | CORS ristretto al dominio dell'app | ✅ | Fixato da wildcard a ALLOWED_ORIGINS |
| 1.9 | Rate limiting 60 req/min | ✅ | slowapi attivo |
| 1.10 | Header sicurezza HTTP | ✅ | X-Frame, HSTS, CSP, nosniff |
| 1.11 | **SECRET_KEY produzione** | ⚠️ | **Impostare su Railway!** |
| 1.12 | **JWT_SECRET_KEY produzione** | ⚠️ | **Impostare su Railway!** |
| 1.13 | Chiavi API non nel repository | ✅ | .gitignore protegge .env |
| 1.14 | Protezione endpoint admin | ✅ | require_admin su tutti gli endpoint |

---

## 2. DATABASE E DATI

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 2.1 | PostgreSQL su Railway | ✅ | Servizio dedicato |
| 2.2 | Dati persistenti (non si perdono al riavvio) | ✅ | Volume PostgreSQL |
| 2.3 | Schema creato automaticamente | ✅ | create_all() su avvio |
| 2.4 | Backup database | ❌ | **DA CONFIGURARE** — vedere punto 9 |
| 2.5 | DATABASE_URL su Railway | ⚠️ | Verificare che punti a PostgreSQL |
| 2.6 | Pool connessioni (10 max) | ✅ | SQLAlchemy pool configurato |
| 2.7 | Tabelle audit log (NIS2) | ✅ | AuditLog registra tutte le azioni |

---

## 3. DEPLOY E INFRASTRUTTURA

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 3.1 | Frontend su Railway | ✅ | React + Nginx |
| 3.2 | Backend su Railway | ✅ | FastAPI + Uvicorn |
| 3.3 | Health check `/api/v1/health` | ✅ | Railway lo usa per monitorare |
| 3.4 | Riavvio automatico in caso di errore | ✅ | restartPolicyType: on_failure |
| 3.5 | Upload file (documenti contratti) | ⚠️ | I file si perdono al redeploy senza volume |
| 3.6 | Variabili ambiente su Railway | ⚠️ | **Verificare lista completa** |
| 3.7 | Logging strutturato JSON | ✅ | Leggibile su Railway Logs |

---

## 4. VARIABILI AMBIENTE DA IMPOSTARE SU RAILWAY

Prima del go-live, verifica che tutte queste variabili siano configurate:

### 🔴 OBBLIGATORIE (la piattaforma non funziona senza)
```bash
SECRET_KEY=<genera con: python -c "import secrets; print(secrets.token_urlsafe(32))">
JWT_SECRET_KEY=<genera con: python -c "import secrets; print(secrets.token_urlsafe(32))">
DATABASE_URL=postgresql://...  # auto da Railway se collegato
ENVIRONMENT=production
DEBUG=false
```

### 🟡 IMPORTANTI (alcune funzioni non funzionano senza)
```bash
APP_BASE_URL=https://[tuo-dominio].up.railway.app  # per link email corretti
ALLOWED_ORIGINS=["https://[tuo-dominio].up.railway.app"]
SMTP_HOST=smtp.gmail.com          # o provider email aziendale
SMTP_PORT=587
SMTP_USER=noreply@telethon.it
SMTP_PASSWORD=<password-smtp>
EMAIL_FROM=noreply@telethon.it
EMAIL_ALBO_FORNITORI=albofornitori@telethon.it
```

### 🟢 OPZIONALI (funzioni avanzate)
```bash
ANTHROPIC_API_KEY=<per analisi AI contratti>
ALYANTE_API_KEY=<per proteggere webhook Alyante>
NC_API_KEY=<per proteggere webhook Non Conformità>
ALYANTE_ENABLED=true
ALYANTE_BASE_URL=https://api.alyante.it/v1
```

---

## 5. EMAIL

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 5.1 | Template email survey | ✅ | HTML professionale |
| 5.2 | Template alert scadenza contratto | ✅ | Inviato 60/30/7/1gg prima |
| 5.3 | Template alert rinegoziazione | ✅ | Inviato 60/30gg prima |
| 5.4 | Template riqualifica fornitore | ✅ | Inviato 30gg prima |
| 5.5 | Scheduler giornaliero (7:00) | ✅ | APScheduler attivo |
| 5.6 | **Configurazione SMTP** | ⚠️ | **Inserire credenziali su Railway** |
| 5.7 | Test email reale | ❌ | **Testare dopo configurazione SMTP** |

---

## 6. FRONTEND E UX

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 6.1 | Dashboard con KPI chiari | ✅ | 4 riquadri + 3 grafici |
| 6.2 | Alert contratti in scadenza | ✅ | Lista con giorni rimasti |
| 6.3 | Pulsante Salva visibile (sticky) | ✅ | Sempre in alto durante la compilazione |
| 6.4 | Messaggi errore comprensibili | ✅ | Testo in italiano |
| 6.5 | Loading states (attesa caricamento) | ✅ | Spinner su tutti i dati |
| 6.6 | Form con validazione | ✅ | Errori in rosso sui campi |
| 6.7 | Export CSV funzionante | ✅ | Fornitori e contratti |
| 6.8 | Pagine accessibili su mobile | ⚠️ | Ant Design responsive, non ottimizzato |
| 6.9 | config.js presente | ✅ | Creato in frontend/public/ |

---

## 7. CONFORMITÀ GDPR E NIS2

| # | Controllo | Stato | Note |
|---|-----------|-------|------|
| 7.1 | Audit log NIS2 | ✅ | Tutte le azioni tracciate |
| 7.2 | Registro trattamenti GDPR | ✅ | Pagina dedicata |
| 7.3 | Diritto all'oblio | ✅ | Pagina con procedura |
| 7.4 | Flag DPA sui contratti | ✅ | Campo dedicato |
| 7.5 | Flag DPIA sui contratti | ✅ | Campo dedicato |
| 7.6 | Questionario IT/GDPR | ✅ | Campo dedicato |
| 7.7 | Password policy NIS2 | ✅ | Min 12 car con complessità |
| 7.8 | **Informativa privacy utenti** | ❌ | Da aggiungere al login |
| 7.9 | **Nomina DPO** | ❌ | Processo organizzativo, non tecnico |
| 7.10 | **Cookie banner** | ❌ | Non necessario (no analytics) |

---

## 8. BACKUP DATABASE

> ❌ **Da fare prima del go-live!**

Railway non fa backup automatici nel piano base. Opzioni:

### Opzione A — pg_dump manuale (gratis)
```bash
# Esegui regolarmente (es. ogni settimana)
pg_dump [DATABASE_URL] > backup_$(date +%Y%m%d).sql
```

### Opzione B — Railway Volume Snapshots (a pagamento)
Dalla dashboard Railway → Database → Backups → Enable automatic backups

### Opzione C — Script automatico con cron esterno
Servizio gratuito come Cron-job.org che chiama un endpoint di backup.

---

## 9. GESTIONE FILE UPLOAD

> ⚠️ **Problema noto:** i file caricati (documenti contratti, certificazioni) vengono salvati localmente nel container. Al redeploy si perdono.

**Soluzione per produzione:**
1. Collegare un **Volume persistente Railway** alla cartella `/app/uploads`
2. Oppure usare **AWS S3 / Cloudflare R2** per lo storage file (richiede sviluppatore)

Per il beta test, il problema non è bloccante — i file si perdono solo con redeploy.

---

## 10. PASSI PER IL GO-LIVE

Esegui questi passi **nell'ordine esatto**:

### Giorno -7 (una settimana prima)
- [ ] Configurare SMTP su Railway e inviare email di test
- [ ] Generare SECRET_KEY e JWT_SECRET_KEY sicuri
- [ ] Impostare APP_BASE_URL con dominio finale
- [ ] Testare il flusso completo survey con email reale

### Giorno -3
- [ ] Popolare il database con dati reali (fornitori esistenti)
- [ ] Creare tutti gli utenti definitivi
- [ ] Eseguire backup del database di beta test
- [ ] Verificare che tutti i contratti attivi siano inseriti

### Giorno -1
- [ ] Eseguire `python seed.py` solo se si vuole database pulito (ATTENZIONE: --reset cancella tutto)
- [ ] Ultimo test del flusso completo
- [ ] Comunicare agli utenti le credenziali

### Giorno 0 (go-live)
- [ ] Cambiare password admin da default
- [ ] Monitorare i log su Railway nelle prime 2 ore
- [ ] Verificare che le email di alert arrivino correttamente

---

## 11. RIEPILOGO PROBLEMI TROVATI E RISOLTI

| Problema | Gravità | Stato |
|----------|---------|-------|
| CORS aperto a tutti (wildcard *) | 🔴 Alta | ✅ Risolto |
| Pulsante Salva invisibile (in fondo a form lunghi) | 🟡 Media | ✅ Risolto (sticky header) |
| config.js mancante (errori browser) | 🟡 Media | ✅ Risolto |
| Logging non strutturato | 🟢 Bassa | ✅ Risolto (JSON logger) |
| Nessun dato di test | 🔴 Alta | ✅ Risolto (script seed) |
| SECRET_KEY di default in produzione | 🔴 Alta | ⚠️ Da configurare su Railway |
| Backup database non configurato | 🔴 Alta | ❌ Da fare |
| File upload non persistenti | 🟡 Media | ⚠️ Da fare per produzione |
| Email SMTP non configurata | 🟡 Media | ⚠️ Da configurare |
| Informativa privacy mancante | 🟢 Bassa | ❌ Da fare |

---

## 12. CONTATTI TECNICI

In caso di problemi tecnici:
- **Log Backend:** Railway Dashboard → Backend service → Logs
- **Health check:** `https://[APP-URL]/api/v1/health`
- **Documentazione API (solo sviluppo):** `https://[APP-URL]/api/docs` (attiva solo con DEBUG=true)

---

*Documento preparato: Marzo 2026 · Versione 1.0.0-beta*
