# Guida UAT — User Acceptance Test
## Procurement System Fondazione Telethon — v1.0

> **Per chi non è sviluppatore:** questa guida ti spiega passo passo come testare
> il sistema prima del go-live. Segui gli step nell'ordine indicato.

---

## Prima di iniziare

Assicurati di avere:
- URL dell'app (es. http://localhost o https://believable-stillness-production-466d.up.railway.app)
- Credenziali admin: `admin / Admin123456!`
- Accesso alla casella email `pepe@tigem.it`
- Se usi Mailhog locale: apri http://localhost:8025 in un'altra scheda

---

## SCENARIO 1 — Login e Dashboard

**Obiettivo:** Verificare che il login funzioni e la dashboard mostri i dati.

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Apri l'app nel browser | Si apre la pagina di login con logo Telethon | |
| 2 | Inserisci username: `admin`, password: `Admin123456!` | Redirect alla Dashboard | |
| 3 | Osserva la Dashboard | Vedi 4 card: Fornitori Attivi, Contratti Attivi, Contratti in Scadenza, Valutazioni Pendenti | |
| 4 | Verifica l'header | Mostra "Sistema Procurement — Fondazione Telethon" con logo | |
| 5 | Verifica il grafico semaforo | Mostra fornitori Verde/Giallo/Rosso | |
| 6 | Verifica contratti in scadenza | Lista contratti con giorni rimanenti evidenziati in rosso/arancione | |

---

## SCENARIO 2 — Albo Fornitori

**Obiettivo:** Verificare la gestione dei fornitori.

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Clicca "Albo Fornitori" nel menu | Si apre la lista fornitori | |
| 2 | Verifica che ci siano almeno 10 fornitori | Lista populated con nomi realistici | |
| 3 | Clicca su un fornitore | Si apre la scheda dettaglio | |
| 4 | Verifica i tab: Info, Contatti, Documenti, Contratti, Comunicazioni | Tutti i tab presenti e funzionanti | |
| 5 | Clicca "+ Nuovo Fornitore" | Si apre il form di inserimento | |
| 6 | Inserisci dati di test e salva | Fornitore creato con successo, messaggio di conferma | |

---

## SCENARIO 3 — Database Contratti

**Obiettivo:** Verificare la gestione contratti e le scadenze.

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Clicca "Database Contratti" | Lista contratti caricata | |
| 2 | Verifica che ci siano almeno 25 contratti | Lista con vari stati (Attivo, Non Attivo, In Rinegoziazione) | |
| 3 | Filtra per "Attivo" | Lista ridotta ai soli contratti attivi | |
| 4 | Verifica contratti con tag rosso (<30gg) | Almeno 3 contratti con scadenza urgente | |
| 5 | Clicca su un contratto | Dettaglio contratto con tutti i dati | |
| 6 | Verifica il badge DPA/GDPR | Mostra lo stato delle compliance GDPR | |

---

## SCENARIO 4 — Vendor Rating Dashboard

**Obiettivo:** Verificare il sistema di valutazione fornitori con i 3 KPI.

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Clicca "Vendor Rating" | Dashboard con tabella fornitori valutati | |
| 2 | Verifica le colonne KPI | Deve mostrare: ⭐ KPI 1 Qualità, ⏱ KPI 2 Tempistiche, 💬 KPI 3 Comunicazione | |
| 3 | Verifica i semafori | Verde (≥4 stelle), Giallo (≥2.5), Rosso (<2.5), Grigio (nessuna val.) | |
| 4 | Filtra per "Verde" | Solo fornitori con semaforo verde | |
| 5 | Clicca su un fornitore | Scheda dettaglio con storico valutazioni | |
| 6 | Verifica le stelline nel dettaglio | K1/K2/K3 mostrano stelline 1-5 per ogni valutazione | |

---

## SCENARIO 5 — Email di Valutazione (CORE TEST)

**Obiettivo:** Testare il flusso completo email → survey → aggiornamento rating.

### 5a. Invio email

```bash
# Da terminale (nella cartella backend):
docker compose exec backend python send_test_email.py --email pepe@tigem.it
```

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Esegui il comando sopra | Stampa "✅ Email inviata con successo a pepe@tigem.it" | |
| 2 | Apri la casella pepe@tigem.it | Email ricevuta con oggetto "⭐ Valuta la fornitura di..." | |
| 3 | Verifica il template email | Header gradient Telethon, 3 KPI descritti, pulsante CTA verde | |

> **Se usi Mailhog:** apri http://localhost:8025 invece della casella reale

### 5b. Compilazione survey

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Clicca "⭐ Lascia la tua valutazione" nell'email | Si apre la pagina survey nel browser | |
| 2 | Verifica la pagina survey | Header Telethon, info fornitore, 3 card KPI con stelline | |
| 3 | Valuta KPI 1 — Qualità della fornitura | Click sulle stelle (1-5), appare il label (Scarso/Ottimo) | |
| 4 | Valuta KPI 2 — Rispetto delle tempistiche | Click sulle stelle | |
| 5 | Valuta KPI 3 — Comunicazione e supporto | Click sulle stelle | |
| 6 | Verifica la media live | In alto appare "Media attuale: X.X / 5" aggiornata in tempo reale | |
| 7 | Aggiungi un commento (opzionale) | Campo note disponibile | |
| 8 | Clicca "⭐ Invia Valutazione" | Pagina di conferma "Grazie per la tua valutazione!" | |

### 5c. Verifica aggiornamento

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Torna al pannello admin → Vendor Rating | Fornitore appare con semaforo aggiornato | |
| 2 | Clicca sul fornitore | Dettaglio mostra la nuova valutazione | |
| 3 | Verifica i KPI | K1, K2, K3 mostrano le stelle che hai inserito | |
| 4 | Verifica Media e Semaforo | Calcolati correttamente dalla media dei 3 KPI | |

---

## SCENARIO 6 — Notifiche Contratti in Scadenza

**Obiettivo:** Verificare che il sistema invii alert per contratti in scadenza.

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Verifica contratti urgenti in Dashboard | Card "Contratti in Scadenza" mostra > 0 | |
| 2 | Forza la verifica scadenze (API) | Risposta 200 OK |  |
| 3 | Controlla Mailhog/casella email | Email di alert per ogni contratto in scadenza | |
| 4 | Verifica il contenuto email | ID contratto, fornitore, oggetto, data scadenza | |

---

## SCENARIO 7 — Admin Panel e Sicurezza

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Clicca "Amministrazione" (solo super_admin) | Pannello con utenti, audit log | |
| 2 | Verifica audit log | Tutte le azioni sono tracciate (login, modifiche, etc.) | |
| 3 | Logout e nuovo login | Token refresh funziona correttamente | |
| 4 | Prova accesso come viewer | Menu ridotto, nessun accesso a contratti/vendor rating | |

---

## SCENARIO 8 — GDPR (se applicabile)

| # | Azione | Risultato atteso | ✓/✗ |
|---|--------|-----------------|-----|
| 1 | Apri un fornitore → "Diritto all'Oblio" | Form per richiesta cancellazione dati | |
| 2 | Vai su "Registro Trattamenti" | Lista dei trattamenti dati documentati | |

---

## Riepilogo risultati UAT

| Scenario | Risultato | Note |
|----------|-----------|------|
| 1. Login e Dashboard | ✓ / ✗ | |
| 2. Albo Fornitori | ✓ / ✗ | |
| 3. Database Contratti | ✓ / ✗ | |
| 4. Vendor Rating Dashboard | ✓ / ✗ | |
| 5. Email + Survey + Rating | ✓ / ✗ | |
| 6. Notifiche Scadenze | ✓ / ✗ | |
| 7. Admin Panel | ✓ / ✗ | |
| 8. GDPR | ✓ / ✗ | |

---

## Contatti per supporto

Per segnalare problemi durante il test UAT, annotare:
- Scenario e step dove si è verificato il problema
- Messaggio di errore (screenshot se possibile)
- Browser e sistema operativo utilizzato

---

*Documento preparato per UAT pre-go-live — Marzo 2026*
