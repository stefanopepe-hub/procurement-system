# Guida Beta Test — Procurement System
### Fondazione Telethon · Ufficio Acquisti

---

## Prima di iniziare: cosa hai davanti

Questa piattaforma è il tuo sistema digitale per gestire:
- **Albo Fornitori** — anagrafica e stato di tutti i fornitori
- **Database Contratti** — tutti i contratti con alert scadenze automatici
- **Valutazioni Fornitori** — sistema di rating (stelle ⭐) dopo ogni fornitura
- **Dashboard** — vista riepilogativa di tutto quello che conta

---

## 1. Come accedere

Vai all'indirizzo dell'app su Railway e inserisci:

| Tipo utente | Username | Password |
|-------------|----------|----------|
| **Super Admin** (vede tutto) | `admin` | `Admin123456!` |
| **Admin Acquisti** (crea e gestisce) | `admin_ufficio` | `Admin2024!Tlt` |
| **Viewer** (solo lettura) | `viewer_luigi` | `Viewer2024!Tlt` |

> **Suggerimento:** accedi prima come `admin_ufficio` — è il profilo tipico di chi usa la piattaforma ogni giorno.

---

## 2. Cosa vedere appena entri (Dashboard)

Dopo il login vedi la **Dashboard**. Controlla che siano presenti:

✅ **4 riquadri numerici** in alto:
- Fornitori Attivi → deve mostrare ~20
- Contratti Attivi → deve mostrare ~35
- Contratti in Scadenza (60gg) → deve mostrare 8-15 (dipende dalle date)
- Valutazioni Pendenti → survey aperte

✅ **Alert giallo** "Valutazioni fornitori in attesa" — se ci sono rating da completare

✅ **Lista contratti in scadenza** — con quelli che scadono prima in cima

✅ **3 grafici** a barre: stato contratti, semaforo fornitori, categorie

✅ **Azioni rapide** in basso a destra: pulsanti per creare fornitore/contratto

---

## 3. Creare un nuovo fornitore

1. Clicca **"Nuovo Fornitore"** (pulsante verde in dashboard o in Albo Fornitori)
2. Compila i campi obbligatori (marcati con \*):
   - **Ragione Sociale** → es. "Fornitore Beta SRL"
   - **Partita IVA** → 11 cifre, es. "99999999999"
3. Aggiungi opzionalmente:
   - Contatti (scheda "Contatti")
   - Certificazioni (ISO 9001, ecc.)
4. Clicca **"Crea Fornitore"** — il pulsante è visibile **sia in alto che in fondo** alla pagina
5. Devi vedere il messaggio verde "Fornitore creato con successo"

> **Cosa testare:** prova a salvare senza Ragione Sociale — deve comparire un errore di validazione in rosso.

---

## 4. Creare un nuovo contratto

1. Clicca **"Nuovo Contratto"** (verde in dashboard)
2. Compila:
   - **Ragione Sociale** fornitore (puoi digitare e cercarne uno dall'Albo)
   - **Oggetto** → descrizione del contratto
   - **Data Scadenza** → metti una data tra 10-20 giorni per testare gli alert
   - **Alert scadenza** → lascia attivo (spunta)
3. Clicca **"Crea Contratto"**
4. Vedrai la pagina di dettaglio del contratto con ID automatico (es. CTR-00061)

> **Cosa testare:** crea un contratto con scadenza tra 7 giorni. Torna in dashboard — deve apparire nella lista "Contratti in Scadenza" con etichetta rossa.

---

## 5. Flusso completo valutazione fornitore

### Come funziona nella realtà:
```
Alyante (gestionale) registra una consegna
        ↓
Sistema invia email al richiedente
        ↓
Richiedente clicca link nell'email
        ↓
Compila il form di valutazione (stelle)
        ↓
Rating salvato e dashboard aggiornata
```

### Come testarlo manualmente (senza email reale):

**Passo A — Simula il webhook di Alyante:**
```bash
curl -X POST https://[TUO-APP-URL]/api/v1/vendor-rating/webhook/alyante \
  -H "Content-Type: application/json" \
  -d '{
    "alyante_order_id": "TEST-001",
    "codice_fornitore": "ALY001",
    "protocollo_ordine": "PROT-TEST-001",
    "tipo_trigger": "opr_completato",
    "tipo_documento": "OPR",
    "data_ordine": "2026-02-01",
    "richiedente_email": "tua@email.it",
    "richiedente_nome": "Tester Beta"
  }'
```
Risposta attesa: `{"message": "Survey created", "request_id": ..., "survey_token": "..."}`

**Passo B — Copia il survey_token dalla risposta e vai su:**
```
https://[TUO-APP-URL]/survey/[TOKEN]
```

**Passo C — Compila il form:**
- Dai un punteggio da 1 a 5 stelle per ogni KPI
- Aggiungi una nota (obbligatoria se dai meno di 3 stelle)
- Clicca "Invia Valutazione"

**Passo D — Verifica in dashboard:**
- Vai su Valutazioni Fornitori
- Cerca "Acme Informatica SRL" → deve mostrare il nuovo rating
- Il semaforo deve essere aggiornato (verde/giallo/rosso)

### Survey già caricate (per test immediato):
Il sistema ha già 17 survey aperte. Vai su:
`/api/v1/vendor-rating/pending-count` con il tuo token JWT per vedere i token disponibili.

---

## 6. Verificare le notifiche email

> ⚠️ **Nota:** le email funzionano solo se sono configurate le variabili SMTP su Railway.

Per verificare che il sistema email sia configurato:
1. Vai in **Admin Panel** (solo super_admin)
2. Controlla le variabili di ambiente SMTP_HOST, SMTP_USER, SMTP_PASSWORD

Se non configurate, le email vengono solo loggiate nel sistema (non inviate) — puoi vederlo nei log di Railway.

**Template email survey:**
```
Da: noreply@telethon.it
Oggetto: Valuta la fornitura di [Fornitore] – Fondazione Telethon
Link: https://[APP-URL]/survey/[TOKEN-SICURO]
Scadenza: 30 giorni dall'invio
```

Il link è:
- **Sicuro** (token di 96 caratteri casuali)
- **Monouso** (non si può rispondere due volte)
- **Con scadenza** (30 giorni)

---

## 7. Gestione Utenti (solo Super Admin)

Vai su **Admin Panel → Gestione Utenti**:

1. Clicca "Nuovo Utente"
2. Scegli il ruolo:
   - **Admin** → accesso completo (Ufficio Acquisti)
   - **Viewer** → sola lettura (altri uffici)
3. La password temporanea viene impostata manualmente

> **Ruoli:** solo `super_admin` può creare altri utenti e vedere l'audit log.

---

## 8. Esportare i dati

Dalla lista **Albo Fornitori**:
- Pulsante **"Esporta CSV"** → scarica tutti i fornitori in Excel/CSV

Dalla lista **Contratti**:
- Pulsante **"Esporta CSV"** → scarica tutti i contratti

---

## 9. Cosa controllare durante il test

| Cosa testare | Come | Risultato atteso |
|---|---|---|
| Login funziona | Inserisci credenziali | Dashboard carica |
| Login errato | Password sbagliata | "Credenziali non valide" |
| Blocco account | 5 tentativi sbagliati | Account bloccato 15 min |
| Salva fornitore | Compila form e clicca Salva | "Fornitore creato" in verde |
| Salva contratto | Compila form e clicca Salva | "Contratto creato" in verde |
| Dashboard si aggiorna | Crea un contratto | Contatore aumenta |
| Export CSV | Clicca Esporta | File scaricato |
| Survey mono-uso | Compila survey, riprova link | "Survey già compilata" |
| Survey scaduta | Usa token vecchio | "Survey scaduta" |
| Viewer limitato | Accedi come viewer_luigi | Non vede Contratti/Valutazioni |

---

## 10. Segnalare un problema

Se qualcosa non funziona, annota:
1. **Cosa stavi facendo** (es. "stavo creando un fornitore")
2. **Cosa è successo** (es. "la pagina si è bloccata" / "errore rosso")
3. **Screenshot** se possibile

Controlla anche i **log su Railway** → Dashboard Railway → Servizio Backend → Logs

---

## Architettura in breve (per capire come gira)

```
[Browser utente]
      ↓ HTTPS
[Frontend React — Railway]  ← pagine visibili
      ↓ /api/v1/...
[Backend FastAPI — Railway] ← logica e dati
      ↓
[Database PostgreSQL — Railway] ← dati persistenti
```

I dati sono **persistenti** su PostgreSQL: non si perdono al riavvio.

---

*Ultima revisione: Marzo 2026 · Versione 1.0.0-beta*
