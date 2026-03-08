# Guida Completa Setup, Seed & Test Email
## Procurement System — Fondazione Telethon

---

## 1. AVVIO DEL SISTEMA (Docker locale)

```bash
# Entra nella cartella del progetto
cd /path/to/procurement-system

# Crea la cartella backup (per il servizio db-backup)
mkdir -p backups

# Avvia tutti i servizi (PostgreSQL, Backend, Frontend, Mailhog, Backup)
docker compose up -d --build

# Controlla che tutti i servizi siano up
docker compose ps
```

**Servizi disponibili dopo l'avvio:**
| Servizio | URL | Note |
|----------|-----|------|
| Frontend | http://localhost:80 | App principale |
| Backend API | http://localhost:8000 | FastAPI |
| Mailhog (email test) | http://localhost:8025 | Visualizza email inviate |
| Backup DB | `./backups/` | Auto ogni notte alle 02:00 |

---

## 2. POPOLAMENTO DATABASE (Seed)

```bash
# Entra nel container backend
docker compose exec backend python seed.py

# OPPURE da locale (con DB su Docker):
cd backend
DATABASE_URL="postgresql://procurement:test1234@localhost:5432/procurement_db" \
python seed.py
```

**Cosa crea il seed:**
- 10 utenti (admin + viewer)
- 20 fornitori con contatti, fatturato e certificazioni
- 60 contratti (35 attivi, 15 non attivi, 10 in rinegoziazione)
- 8 contratti in scadenza urgente (< 30 giorni)
- 120 valutazioni fornitore con i 3 KPI
- Survey UAT per pepe@tigem.it

**Credenziali di accesso:**
```
Super Admin:    admin / Admin123456!
Admin:          admin_ufficio / Admin2024!Tlt
Viewer:         viewer_luigi / Viewer2024!Tlt
```

---

## 3. INVIO EMAIL DI TEST — pepe@tigem.it

### Opzione A: Mailhog (solo test locale, no email reale)

```bash
# Con Mailhog già configurato nel .env (localhost:1025)
docker compose exec backend python send_test_email.py --email pepe@tigem.it

# Poi apri http://localhost:8025 per vedere l'email ricevuta
```

### Opzione B: Email reale tramite Gmail SMTP

1. Apri Railway → tuo progetto backend → Variables
2. Aggiungi queste variabili:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=tuo-indirizzo@gmail.com
SMTP_PASSWORD=app-password-gmail    # Vedi nota sotto
EMAIL_FROM=noreply@telethon.it
EMAIL_ALBO_FORNITORI=pepe@tigem.it
APP_BASE_URL=https://believable-stillness-production-466d.up.railway.app
```

> **Come ottenere App Password Gmail:**
> 1. Vai su myaccount.google.com → Sicurezza
> 2. Abilita "Verifica in 2 passaggi"
> 3. Vai su "Password per le app" → crea password per "Posta"
> 4. Usa la password generata (16 caratteri) come SMTP_PASSWORD

3. Esegui il test:

```bash
docker compose exec backend python send_test_email.py \
  --email pepe@tigem.it
```

### Opzione C: Trigger manuale via API (dopo seed)

```bash
# Usa il token stampato dal seed e apri nel browser:
http://localhost:80/survey/TOKEN_STAMPATO_DAL_SEED
```

---

## 4. FLUSSO COMPLETO UAT — Step by Step

### Step 1: Login
- Apri http://localhost:80
- Accedi con `admin / Admin123456!`

### Step 2: Esplora il Dashboard
- Verificare i 4 KPI cards: Fornitori, Contratti Attivi, Contratti in Scadenza, Valutazioni Pendenti
- Verificare il grafico Semaforo Fornitori
- Verificare la lista Contratti in Scadenza

### Step 3: Albo Fornitori
- Vai su "Albo Fornitori"
- Verifica 20 fornitori con badge semaforo
- Clicca un fornitore → verifica dati, contatti, contratti

### Step 4: Database Contratti
- Vai su "Database Contratti"
- Filtra per "Attivo"
- Verifica contratti con scadenza imminente (tag rosso)

### Step 5: Vendor Rating — Dashboard
- Vai su "Vendor Rating"
- Verifica fornitori con semaforo (verde/giallo/rosso)
- Verifica le 3 colonne KPI: Qualità, Tempistiche, Comunicazione

### Step 6: Invio Email di Valutazione
```bash
# Esegui da terminale
docker compose exec backend python send_test_email.py --email pepe@tigem.it
```
- Verifica che lo script stampi "✅ Email inviata con successo"
- Apri la casella pepe@tigem.it (o http://localhost:8025 per Mailhog)

### Step 7: Compilazione Survey
- Apri l'email ricevuta
- Clicca "⭐ Lascia la tua valutazione"
- Compila i 3 KPI con le stelline:
  - ⭐ KPI 1 — Qualità della fornitura
  - ⏱ KPI 2 — Rispetto delle tempistiche
  - 💬 KPI 3 — Comunicazione e supporto
- Aggiungi un commento (opzionale)
- Clicca "Invia Valutazione"

### Step 8: Verifica aggiornamento
- Torna al pannello admin → Vendor Rating
- Verifica che il fornitore mostri:
  - Rating aggiornato
  - Semaforo corretto (verde ≥4, giallo ≥2.5, rosso <2.5)
  - KPI 1/2/3 con le stelle

### Step 9: Notifiche contratti in scadenza
- In sviluppo il job gira ogni giorno alle 07:00
- Per forzare manualmente:

```bash
# Tramite API admin
curl -X POST http://localhost:8000/api/v1/admin/check-expiries \
  -H "Authorization: Bearer <token>"
```

---

## 5. CONFIGURAZIONE RAILWAY (Produzione)

### Variabili obbligatorie
```env
SECRET_KEY=<genera con: python -c "import secrets; print(secrets.token_urlsafe(32))">
JWT_SECRET_KEY=<genera con: python -c "import secrets; print(secrets.token_urlsafe(32))">
DATABASE_URL=<fornito da Railway PostgreSQL>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_TLS=true
SMTP_USER=tuo@gmail.com
SMTP_PASSWORD=<app-password>
EMAIL_FROM=noreply@telethon.it
EMAIL_ALBO_FORNITORI=albofornitori@telethon.it
APP_BASE_URL=https://believable-stillness-production-466d.up.railway.app
```

### Eseguire seed su Railway
```bash
# Tramite Railway CLI
railway run python seed.py

# OPPURE tramite Railway Console nel pannello web
```

---

## 6. BACKUP DATABASE

Il backup è configurato automaticamente con `db-backup` nel docker-compose.

**Manuale:**
```bash
# Backup immediato
docker compose exec db pg_dump -U procurement procurement_db > backup_$(date +%Y%m%d).sql

# Restore da backup
cat backup_20260308.sql | docker compose exec -T db psql -U procurement procurement_db
```

**Railway:** Configura Railway Volumes o usa pg_dump tramite la Railway CLI.

---

## 7. STRUTTURA EMAIL TEMPLATE

Il template email per la valutazione include:
- Header gradient Fondazione Telethon (blu → rosso)
- Info fornitore e riferimento ordine
- Descrizione dei 3 KPI da valutare
- Pulsante CTA prominente "⭐ Lascia la tua valutazione"
- Footer con note GDPR

---

## Problemi comuni

| Problema | Soluzione |
|---------|---------|
| Email non arriva | Verifica SMTP_HOST in .env; usa Mailhog su localhost:8025 |
| Survey "non trovata" | Il token è scaduto o già usato; esegui `send_test_email.py` per nuovo token |
| Seed fallisce | Verifica DATABASE_URL; tabelle già parzialmente popolate → usa `--reset` |
| KPI non mostrano stelle | Il seed è stato eseguito correttamente? Verifica /vendor-rating |
