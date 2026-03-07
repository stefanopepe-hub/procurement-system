#!/usr/bin/env python3
"""
=============================================================================
PROCUREMENT SYSTEM — GENERATORE DOCUMENTI PDF DI TEST
=============================================================================
Genera contratti PDF fittizi realistici per testare:
  • Upload documenti su fornitori e contratti
  • Analisi AI (Claude) su testo contrattuale
  • Flusso completo documento → visualizzazione

USO:
  cd backend
  DATABASE_URL="postgresql://..." python generate_test_docs.py
  oppure senza DB (genera solo i PDF):
  python generate_test_docs.py --only-pdf

OUTPUT:
  ./test_documents/  ← cartella con i PDF generati
=============================================================================
"""

import sys
import os
import random
from datetime import date, datetime, timedelta
from pathlib import Path

# ── Installazione dipendenze ─────────────────────────────────────────────────
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.colors import HexColor, black, white
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak
    )
    from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT, TA_RIGHT
except ImportError:
    print("❌ reportlab non installato. Esegui: pip install reportlab")
    sys.exit(1)

OUTPUT_DIR = Path("./test_documents")

TELETHON_BLUE = HexColor('#1a3a5c')
TELETHON_RED  = HexColor('#E31837')
LIGHT_GREY    = HexColor('#f5f5f5')
MID_GREY      = HexColor('#888888')


# ─────────────────────────────────────────────────────────────────────────────
# Dati fittizi realistici
# ─────────────────────────────────────────────────────────────────────────────

CONTRATTI = [
    {
        "titolo": "Contratto di Fornitura Reagenti da Laboratorio",
        "id": "CTR-00001",
        "fornitore": "Farmaceutica Nord SRL",
        "piva_fornitore": "05678901234",
        "oggetto": (
            "Fornitura di reagenti chimici e biologici per attività di ricerca scientifica, "
            "inclusi anticorpi, enzimi, substrati e materiali di consumo per laboratorio. "
            "La fornitura comprende reagenti certificati CE/IVD conformi alle normative vigenti."
        ),
        "imponibile": "€ 85.000,00",
        "iva": "22%",
        "ivato": "€ 103.700,00",
        "data_inizio": "01/01/2025",
        "data_scadenza": "31/12/2025",
        "cdc": "RICERCA-LAB-01",
        "referente_interno": "Dr. Marco Rossi",
        "referente_ufficio": "Dott.ssa Sara Colombo",
        "clausole": [
            ("Oggetto del contratto", True, "Fornitura reagenti laboratorio come specificato nell'allegato tecnico A"),
            ("Durata e scadenza", True, "Il contratto ha durata annuale dal 01/01/2025 al 31/12/2025"),
            ("Corrispettivo e pagamento", True, "Pagamento a 60 giorni dalla data di fattura elettronica"),
            ("Penali e inadempimento", True, "Penale pari all'1% dell'importo ordinato per ogni settimana di ritardo"),
            ("Riservatezza", True, "Obbligo di riservatezza su dati scientifici e processi interni"),
            ("Trattamento dati (GDPR/DPA)", True, "DPA firmato in allegato B — Telethon è Titolare, Fornitore è Responsabile"),
            ("Proprietà intellettuale", True, "Tutti i risultati della ricerca rimangono di proprietà esclusiva di Fondazione Telethon"),
            ("Recesso anticipato", True, "Recesso con preavviso di 60 giorni tramite PEC"),
            ("Limitazione responsabilità", True, "Responsabilità del Fornitore limitata al valore annuo del contratto"),
            ("Foro competente", True, "Foro di Roma. Legge applicabile: diritto italiano"),
            ("Forza maggiore", True, "Sospensione obbligazioni in caso di eventi di forza maggiore documentati"),
            ("Subappalto", False, None),
            ("Garanzie e SLA", True, "Garanzia di conformità alle specifiche tecniche per 12 mesi dalla consegna"),
            ("Risoluzione controversie", True, "Tentativo obbligatorio di mediazione prima del contenzioso"),
            ("Anticorruzione", True, "Il Fornitore dichiara di rispettare il D.Lgs. 231/2001"),
            ("Revisione prezzi", False, None),
        ],
        "criticita": [
            ("⚠️ CLAUSOLA MANCANTE: Subappalto", "Non è definita la procedura per il subappalto di parte delle forniture. "
             "Telethon potrebbe non essere informata di fornitori sub-terzi che trattano materiali sensibili."),
            ("⚠️ CLAUSOLA MANCANTE: Revisione prezzi", "In assenza di clausola di revisione prezzi, aumenti delle materie prime "
             "potrebbero rendere il contratto economicamente svantaggioso per entrambe le parti."),
        ],
        "punteggio": 78,
        "rischio": "Medio",
    },
    {
        "titolo": "Contratto di Servizi IT Gestiti e Helpdesk",
        "id": "CTR-00008",
        "fornitore": "IT Cloud Services SpA",
        "piva_fornitore": "12340987654",
        "oggetto": (
            "Fornitura di servizi IT gestiti (Managed Services) comprendenti: infrastruttura cloud, "
            "backup automatizzato, monitoring 24/7, helpdesk di primo e secondo livello, "
            "aggiornamento sistemi operativi e applicativi, gestione firewall e sicurezza perimetrale."
        ),
        "imponibile": "€ 240.000,00",
        "iva": "22%",
        "ivato": "€ 292.800,00",
        "data_inizio": "01/03/2025",
        "data_scadenza": "28/02/2027",
        "cdc": "CDC002",
        "referente_interno": "Ing. Federica Marini",
        "referente_ufficio": "Dott. Pietro Gallo",
        "clausole": [
            ("Oggetto del contratto", True, "Servizi IT gestiti come da allegato tecnico con SLA garantiti"),
            ("Durata e scadenza", True, "Contratto biennale con opzione di rinnovo tacito"),
            ("Corrispettivo e pagamento", True, "Canone mensile posticipato di € 10.000 + IVA"),
            ("Penali e inadempimento", True, "Penale per SLA breach: € 500/ora per downtime oltre soglia contrattuale"),
            ("Riservatezza", True, "NDA firmato in allegato — dati riservati classificati CONFIDENTIAL"),
            ("Trattamento dati (GDPR/DPA)", True, "DPA completo — fornitore opera come Responsabile del trattamento ex Art. 28 GDPR"),
            ("Proprietà intellettuale", True, "Software sviluppato su specifica rimane di proprietà Telethon"),
            ("Recesso anticipato", True, "Recesso per giusta causa con effetto immediato; ordinario con 90 gg preavviso"),
            ("Limitazione responsabilità", True, "Cap responsabilità: 12 mensilità del canone"),
            ("Foro competente", True, "Foro di Milano. Legge italiana applicabile"),
            ("Forza maggiore", True, "Clausola di forza maggiore con obbligo di notifica entro 48h"),
            ("Subappalto", True, "Subappalto consentito previa autorizzazione scritta di Telethon"),
            ("Garanzie e SLA", True, "Uptime garantito 99,5% mensile; RTO 4h; RPO 1h per backup"),
            ("Risoluzione controversie", True, "Arbitrato camerale prima del contenzioso ordinario"),
            ("Anticorruzione", True, "Codice Etico di Fondazione Telethon allegato e accettato"),
            ("Revisione prezzi", True, "Revisione annuale ISTAT (indice FOI) con cap del 3%"),
        ],
        "criticita": [
            ("⚠️ RISCHIO: Rinnovo tacito", "Il rinnovo tacito automatico potrebbe non essere rilevato in tempo. "
             "Si raccomanda di impostare un alert 6 mesi prima della scadenza per valutare eventuali rinegoziazioni."),
        ],
        "punteggio": 91,
        "rischio": "Basso",
    },
    {
        "titolo": "Contratto di Fornitura Dispositivi Medici Diagnostici",
        "id": "CTR-00015",
        "fornitore": "Medical Device Italia SRL",
        "piva_fornitore": "34567890123",
        "oggetto": (
            "Fornitura, installazione, collaudo e manutenzione di dispositivi medici diagnostici "
            "per attività di ricerca biomedica, inclusi analizzatori, sequenziatori e strumentazione "
            "per diagnostica molecolare. Conformi a Reg. UE 2017/746 (IVDR)."
        ),
        "imponibile": "€ 320.000,00",
        "iva": "10%",
        "ivato": "€ 352.000,00",
        "data_inizio": "15/02/2025",
        "data_scadenza": "14/02/2028",
        "cdc": "RICERCA-BIO-03",
        "referente_interno": "Prof.ssa Anna Ricci",
        "referente_ufficio": "Mario Bianchi",
        "clausole": [
            ("Oggetto del contratto", True, "Fornitura strumentazione diagnostica come da offerta tecnica n. MED-2025-047"),
            ("Durata e scadenza", True, "Contratto triennale con garanzia estesa inclusa"),
            ("Corrispettivo e pagamento", True, "30% all'ordine, 40% alla consegna, 30% al collaudo positivo"),
            ("Penali e inadempimento", True, "Penale 2% per ogni mese di ritardo sulla data di consegna concordata"),
            ("Riservatezza", True, "Dati di ricerca classificati come proprietà riservata Telethon"),
            ("Trattamento dati (GDPR/DPA)", False, None),
            ("Proprietà intellettuale", True, "I dati prodotti dagli strumenti rimangono di proprietà esclusiva di Fondazione Telethon"),
            ("Recesso anticipato", True, "Recesso con preavviso di 90 giorni"),
            ("Limitazione responsabilità", True, "Responsabilità limitata al valore contrattuale"),
            ("Foro competente", True, "Foro di Roma"),
            ("Forza maggiore", True, "Clausola standard con elenco esemplificativo di eventi"),
            ("Subappalto", True, "Solo installazione, previa comunicazione scritta"),
            ("Garanzie e SLA", True, "Garanzia 3 anni on-site; tempo di intervento max 8h lavorative"),
            ("Risoluzione controversie", False, None),
            ("Anticorruzione", True, "Dichiarazione D.Lgs. 231/2001 allegata"),
            ("Revisione prezzi", False, None),
        ],
        "criticita": [
            ("🔴 CRITICO: DPA mancante", "Il contratto non include un Data Processing Agreement (DPA). "
             "Poiché i dispositivi potrebbero elaborare dati relativi a campioni biologici identificabili, "
             "è obbligatorio ex Art. 28 GDPR stipulare un DPA prima dell'avvio delle attività."),
            ("⚠️ CLAUSOLA MANCANTE: Risoluzione controversie", "Manca la clausola di mediazione/arbitrato. "
             "In caso di contenzioso si ricorre direttamente al giudice ordinario con costi e tempi maggiori."),
            ("⚠️ CLAUSOLA MANCANTE: Revisione prezzi", "Su un contratto triennale in assenza di revisione prezzi, "
             "il rischio inflattivo è interamente a carico di Fondazione Telethon."),
        ],
        "punteggio": 64,
        "rischio": "Alto",
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Funzioni di rendering PDF
# ─────────────────────────────────────────────────────────────────────────────

def make_styles():
    styles = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('ct', fontName='Helvetica-Bold', fontSize=16,
                                textColor=TELETHON_BLUE, spaceAfter=6, leading=20),
        'subtitle': ParagraphStyle('cs', fontName='Helvetica-Bold', fontSize=12,
                                   textColor=TELETHON_BLUE, spaceAfter=4, spaceBefore=12),
        'body': ParagraphStyle('cb', fontName='Helvetica', fontSize=10,
                               textColor=black, spaceAfter=6, leading=16, alignment=TA_JUSTIFY),
        'small': ParagraphStyle('csmall', fontName='Helvetica', fontSize=8,
                                textColor=MID_GREY, spaceAfter=4),
        'center': ParagraphStyle('cc', fontName='Helvetica', fontSize=10,
                                 alignment=TA_CENTER, textColor=black),
        'bold': ParagraphStyle('cbold', fontName='Helvetica-Bold', fontSize=10,
                               textColor=black, spaceAfter=4),
        'red': ParagraphStyle('cred', fontName='Helvetica-Bold', fontSize=9,
                              textColor=TELETHON_RED, spaceAfter=2),
        'header_label': ParagraphStyle('chl', fontName='Helvetica', fontSize=8,
                                       textColor=MID_GREY),
        'header_value': ParagraphStyle('chv', fontName='Helvetica-Bold', fontSize=10,
                                       textColor=TELETHON_BLUE),
    }


def build_header(s, contratto):
    elements = []
    # Header table: logo placeholder + titolo contratto
    header_data = [[
        Paragraph('<b>FONDAZIONE TELETHON</b><br/><font size="8" color="grey">Via Poerio 14, 20129 Milano · CF 03542200232</font>', s['bold']),
        Paragraph(f'<font color="#1a3a5c"><b>{contratto["id"]}</b></font>', s['header_value']),
    ]]
    t = Table(header_data, colWidths=[11*cm, 6*cm])
    t.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('ALIGN', (1,0), (1,0), 'RIGHT'),
        ('LINEBELOW', (0,0), (-1,0), 1.5, TELETHON_BLUE),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4*cm))
    # Linea rossa decorativa
    elements.append(HRFlowable(width='100%', thickness=3, color=TELETHON_RED, spaceAfter=12))
    return elements


def build_contratto_pdf(contratto: dict, output_path: Path):
    doc = SimpleDocTemplate(
        str(output_path),
        pagesize=A4,
        leftMargin=2.2*cm, rightMargin=2.2*cm,
        topMargin=2*cm, bottomMargin=2*cm,
    )
    s = make_styles()
    elements = []

    # ── Header ──────────────────────────────────────────────────────────────
    elements += build_header(s, contratto)

    # ── Titolo ──────────────────────────────────────────────────────────────
    elements.append(Paragraph(contratto['titolo'].upper(), s['title']))
    elements.append(Spacer(1, 0.3*cm))

    # ── Riquadro dati chiave ─────────────────────────────────────────────────
    dati = [
        ['Parti contraenti', '', 'Date', ''],
        [
            Paragraph(f'<b>Committente:</b> Fondazione Telethon<br/>'
                      f'C.F. 03542200232 · Via Poerio 14, Milano', s['body']),
            Paragraph(f'<b>Fornitore:</b> {contratto["fornitore"]}<br/>'
                      f'P.IVA {contratto["piva_fornitore"]}', s['body']),
            Paragraph(f'<b>Inizio:</b> {contratto["data_inizio"]}<br/>'
                      f'<b>Scadenza:</b> {contratto["data_scadenza"]}', s['body']),
            Paragraph(f'<b>Imponibile:</b> {contratto["imponibile"]}<br/>'
                      f'<b>IVA:</b> {contratto["iva"]} → <b>{contratto["ivato"]}</b>', s['body']),
        ],
    ]
    t = Table(dati, colWidths=[4.2*cm, 5.5*cm, 4*cm, 3.3*cm])
    t.setStyle(TableStyle([
        ('SPAN', (0,0), (1,0)),
        ('SPAN', (2,0), (3,0)),
        ('BACKGROUND', (0,0), (1,0), TELETHON_BLUE),
        ('BACKGROUND', (2,0), (3,0), TELETHON_BLUE),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (0,0), (-1,0), 'CENTER'),
        ('BACKGROUND', (0,1), (-1,1), LIGHT_GREY),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('GRID', (0,0), (-1,-1), 0.5, HexColor('#dddddd')),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.4*cm))

    # ── Art. 1 — Oggetto ─────────────────────────────────────────────────────
    elements.append(Paragraph('Art. 1 — Oggetto del Contratto', s['subtitle']))
    elements.append(Paragraph(contratto['oggetto'], s['body']))

    # ── Art. 2 — Obblighi delle parti ────────────────────────────────────────
    elements.append(Paragraph('Art. 2 — Obblighi del Fornitore', s['subtitle']))
    elements.append(Paragraph(
        f'Il Fornitore si obbliga a: (i) consegnare i beni/servizi nelle quantità, qualità e '
        f'tempi concordati; (ii) mantenere la piena conformità alla normativa italiana ed europea '
        f'applicabile al settore di riferimento; (iii) notificare tempestivamente qualunque '
        f'impedimento che possa influire sulla corretta esecuzione del contratto; '
        f'(iv) rispettare il Codice Etico di Fondazione Telethon allegato al presente contratto.',
        s['body']
    ))

    # ── Art. 3 — Corrispettivo ───────────────────────────────────────────────
    elements.append(Paragraph('Art. 3 — Corrispettivo e Modalità di Pagamento', s['subtitle']))
    elements.append(Paragraph(
        f'Il corrispettivo contrattuale è pari a <b>{contratto["imponibile"]}</b> + IVA '
        f'<b>{contratto["iva"]}</b>, per un totale di <b>{contratto["ivato"]}</b>. '
        f'Il pagamento avverrà tramite bonifico bancario entro 60 giorni dalla data di ricezione '
        f'della fattura elettronica (ai sensi del D.Lgs. 231/2002). '
        f'Il CdC di riferimento è <b>{contratto["cdc"]}</b>.',
        s['body']
    ))

    # ── Art. 4 — Trattamento Dati (GDPR) ─────────────────────────────────────
    elements.append(Paragraph('Art. 4 — Trattamento dei Dati Personali (GDPR)', s['subtitle']))
    elements.append(Paragraph(
        'Ai sensi dell\'Art. 28 del Reg. UE 2016/679 (GDPR), il Fornitore opera in qualità di '
        'Responsabile del Trattamento per conto di Fondazione Telethon (Titolare). '
        'Il Fornitore si impegna a: trattare i dati esclusivamente secondo le istruzioni del '
        'Titolare; adottare misure di sicurezza adeguate ex Art. 32 GDPR; non trasferire dati '
        'extra-SEE senza adeguate garanzie; notificare violazioni entro 24h. '
        'Il Data Processing Agreement (DPA) costituisce parte integrante del presente contratto.',
        s['body']
    ))

    # ── Art. 5 — Sicurezza (NIS2) ────────────────────────────────────────────
    elements.append(Paragraph('Art. 5 — Sicurezza delle Informazioni (NIS2)', s['subtitle']))
    elements.append(Paragraph(
        'Il Fornitore dichiara di adottare misure di sicurezza informatica conformi alla '
        'Direttiva UE 2022/2555 (NIS2) e al D.Lgs. 138/2024, includendo: gestione delle '
        'vulnerabilità, autenticazione multi-fattore per accessi remoti, cifratura dei dati '
        'in transito e a riposo, piano di continuità operativa e gestione degli incidenti. '
        'Il Fornitore si obbliga a notificare qualsiasi incidente di sicurezza entro 24h.',
        s['body']
    ))

    # ── Tabella Clausole ─────────────────────────────────────────────────────
    elements.append(Paragraph('Riepilogo Clausole Standard', s['subtitle']))
    clausole_data = [['#', 'Clausola', 'Presente', 'Note']]
    for i, (nome, presente, nota) in enumerate(contratto['clausole'], 1):
        check = '✓' if presente else '✗'
        color_text = '#52c41a' if presente else '#ff4d4f'
        clausole_data.append([
            str(i),
            nome,
            Paragraph(f'<font color="{color_text}"><b>{check}</b></font>', s['center']),
            Paragraph(nota or ('— clausola assente —'), s['small']) if nota else
            Paragraph('<font color="#ff4d4f">— clausola assente —</font>', s['small']),
        ])
    ct = Table(clausole_data, colWidths=[0.7*cm, 6.5*cm, 1.5*cm, 8.3*cm])  # total 17cm
    ct.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), TELETHON_BLUE),
        ('TEXTCOLOR', (0,0), (-1,0), white),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,0), 9),
        ('ALIGN', (2,0), (2,-1), 'CENTER'),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [white, LIGHT_GREY]),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#dddddd')),
        ('FONTSIZE', (0,1), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('LEFTPADDING', (0,0), (-1,-1), 4),
    ]))
    elements.append(ct)
    elements.append(Spacer(1, 0.4*cm))

    # ── Criticità ────────────────────────────────────────────────────────────
    if contratto['criticita']:
        elements.append(Paragraph('Criticità e Raccomandazioni', s['subtitle']))
        for titolo_cr, desc_cr in contratto['criticita']:
            elements.append(Paragraph(titolo_cr, s['red']))
            elements.append(Paragraph(desc_cr, s['body']))

    # ── Punteggio conformità ─────────────────────────────────────────────────
    elements.append(Spacer(1, 0.4*cm))
    score = contratto['punteggio']
    rischio = contratto['rischio']
    score_color = '#52c41a' if score >= 80 else ('#faad14' if score >= 60 else '#ff4d4f')
    elements.append(Paragraph(
        f'<b>Punteggio di Conformità:</b> <font color="{score_color}"><b>{score}/100</b></font> '
        f'— Livello di Rischio: <b>{rischio}</b>',
        s['bold']
    ))

    # ── Firme ────────────────────────────────────────────────────────────────
    elements.append(Spacer(1, 1*cm))
    elements.append(HRFlowable(width='100%', thickness=0.5, color=HexColor('#cccccc')))
    elements.append(Spacer(1, 0.4*cm))
    firme_data = [[
        Paragraph(f'<b>Per Fondazione Telethon</b><br/><br/>'
                  f'Referente interno: {contratto["referente_interno"]}<br/>'
                  f'Ufficio Acquisti: {contratto["referente_ufficio"]}<br/><br/>'
                  f'Firma: ___________________________<br/>'
                  f'Data: {contratto["data_inizio"]}', s['body']),
        Paragraph(f'<b>Per {contratto["fornitore"]}</b><br/><br/>'
                  f'Il Legale Rappresentante<br/><br/><br/>'
                  f'Firma: ___________________________<br/>'
                  f'Data: {contratto["data_inizio"]}', s['body']),
    ]]
    ft = Table(firme_data, colWidths=[8.5*cm, 8.5*cm])
    ft.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LINEAFTER', (0,0), (0,-1), 0.5, HexColor('#cccccc')),
        ('LEFTPADDING', (1,0), (1,-1), 20),
    ]))
    elements.append(ft)

    # ── Footer legale ────────────────────────────────────────────────────────
    elements.append(Spacer(1, 0.8*cm))
    elements.append(HRFlowable(width='100%', thickness=1, color=TELETHON_BLUE))
    elements.append(Paragraph(
        'Fondazione Telethon · Via Poerio 14, 20129 Milano · C.F. 03542200232 · '
        'dpo@telethon.it · www.telethon.it · Documento riservato — uso interno',
        s['small']
    ))

    doc.build(elements)
    print(f'  ✓ {output_path.name}')


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("PROCUREMENT SYSTEM — GENERATORE DOCUMENTI PDF DI TEST")
    print("=" * 60)

    OUTPUT_DIR.mkdir(exist_ok=True)
    print(f"\nGenerazione PDF in: {OUTPUT_DIR.resolve()}\n")

    for contratto in CONTRATTI:
        filename = f"{contratto['id']}_{contratto['fornitore'].replace(' ', '_')}.pdf"
        output_path = OUTPUT_DIR / filename
        build_contratto_pdf(contratto, output_path)

    # Genera anche un documento fornitore (VISURA/certificazione)
    _generate_visura_pdf()

    print(f"\n{'='*60}")
    print(f"✅ {len(CONTRATTI) + 1} documenti generati in {OUTPUT_DIR.resolve()}")
    print(f"\nCome usare i documenti:")
    print(f"  1. Aprire il sistema e loggarsi come admin_ufficio")
    print(f"  2. Aprire un contratto → Tab 'Documenti' → Upload PDF")
    print(f"  3. Per test AI: Tab 'Analisi AI' → seleziona PDF → Analizza")
    print(f"  4. Per fornitore: Albo Fornitori → Dettaglio → Tab 'Qualifica' → Upload")
    print(f"{'='*60}")


def _generate_visura_pdf():
    """Genera una visura camerale fittizia per test upload su fornitore."""
    output_path = OUTPUT_DIR / "VISURA_Farmaceutica_Nord_SRL.pdf"
    doc = SimpleDocTemplate(str(output_path), pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=2*cm, bottomMargin=2*cm)
    s = make_styles()
    elements = [
        Paragraph('CAMERA DI COMMERCIO DI MILANO MONZA BRIANZA LODI', s['subtitle']),
        Paragraph('VISURA CAMERALE ORDINARIA', s['title']),
        HRFlowable(width='100%', thickness=2, color=TELETHON_BLUE),
        Spacer(1, 0.5*cm),
        Paragraph('<b>DATI IDENTIFICATIVI</b>', s['subtitle']),
    ]

    dati_visura = [
        ['Denominazione', 'FARMACEUTICA NORD SRL'],
        ['Codice fiscale / P.IVA', '05678901234'],
        ['Numero REA', 'MI-2345678'],
        ['Forma giuridica', 'Società a Responsabilità Limitata'],
        ['Sede legale', 'Via delle Industrie 42, 20090 Segrate (MI)'],
        ['Capitale sociale', '€ 200.000,00 i.v.'],
        ['Codice ATECO', '21.20.09 — Produzione di prodotti farmaceutici'],
        ['Data costituzione', '15/03/2008'],
        ['Stato', 'ATTIVA'],
        ['PEC', 'farmaceuticanord@pec.it'],
    ]
    t = Table(dati_visura, colWidths=[5*cm, 12*cm])
    t.setStyle(TableStyle([
        ('FONTNAME', (0,0), (0,-1), 'Helvetica-Bold'),
        ('FONTSIZE', (0,0), (-1,-1), 9),
        ('ROWBACKGROUNDS', (0,0), (-1,-1), [white, LIGHT_GREY]),
        ('GRID', (0,0), (-1,-1), 0.3, HexColor('#dddddd')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
    ]))
    elements.append(t)
    elements.append(Spacer(1, 0.5*cm))
    elements.append(Paragraph(
        '<i>Documento generato automaticamente a fini di test. '
        'I dati presenti sono fittizi e non corrispondono a soggetti reali.</i>',
        s['small']
    ))
    doc.build(elements)
    print(f'  ✓ {output_path.name}')


if __name__ == '__main__':
    main()
