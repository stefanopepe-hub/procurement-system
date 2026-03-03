"""
AI Contract Analysis Service
Extracts text from contract PDFs and uses Claude to identify clauses,
criticalities and standardization opportunities.
"""
import io
import json
import logging

import anthropic
import pdfplumber

from app.config import settings

logger = logging.getLogger(__name__)

# ─── Standard clauses that every Telethon procurement contract should contain ──

STANDARD_CLAUSES = [
    "Oggetto del contratto",
    "Durata e scadenza",
    "Corrispettivo e modalità di pagamento",
    "Penali e inadempimento",
    "Riservatezza e non divulgazione",
    "Trattamento dei dati personali (GDPR / DPA)",
    "Proprietà intellettuale",
    "Recesso anticipato",
    "Limitazione di responsabilità",
    "Foro competente e legge applicabile",
    "Forza maggiore",
    "Subappalto e cessione del contratto",
    "Garanzie e livelli di servizio (SLA)",
    "Risoluzione delle controversie",
    "Anticorruzione e codice etico",
    "Clausola di revisione prezzi",
]

# ─── PDF text extraction ────────────────────────────────────────────────────────


def extract_pdf_text(file_bytes: bytes) -> str:
    """
    Extract all readable text from a PDF file.
    Returns concatenated page texts separated by double newlines.
    Raises ValueError if the PDF produces no usable text.
    """
    pages: list[str] = []
    with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text and text.strip():
                pages.append(text.strip())

    if not pages:
        raise ValueError("Il PDF non contiene testo estraibile (potrebbe essere una scansione).")

    return "\n\n".join(pages)


# ─── AI Analysis ────────────────────────────────────────────────────────────────

_SYSTEM_PROMPT = """\
Sei un esperto legale specializzato in contratti di appalto e procurement per enti \
no-profit italiani, in particolare per Fondazione Telethon. \
Il tuo compito è analizzare testi contrattuali, identificare clausole chiave, \
criticità legali e opportunità di standardizzazione, rispettando la normativa \
italiana e le best practice di settore (D.Lgs. 36/2023, GDPR, NIS2).\
"""

_CLAUSE_LIST = "\n".join(f"  - {c}" for c in STANDARD_CLAUSES)

_USER_PROMPT_TEMPLATE = """\
Analizza il seguente testo contrattuale e rispondi ESCLUSIVAMENTE con un oggetto JSON \
valido (senza markdown, senza testo aggiuntivo prima o dopo).

### Clausole standard da verificare
{clause_list}

### Struttura JSON richiesta
{{
  "riepilogo_esecutivo": "<2-3 frasi che descrivono l'essenza del contratto>",
  "parti_contrattuali": ["<nome parte 1>", "<nome parte 2>"],
  "date_chiave": {{
    "data_inizio": "<YYYY-MM-DD o null>",
    "data_scadenza": "<YYYY-MM-DD o null>",
    "data_rinegoziazione": "<YYYY-MM-DD o null>"
  }},
  "valore_economico": "<stringa con importo, valuta e dettagli o null>",
  "clausole_standard": [
    {{
      "nome": "<nome clausola>",
      "presente": true,
      "contenuto": "<breve estratto testuale>",
      "note": "<eventuale nota>"
    }},
    {{
      "nome": "<nome clausola mancante>",
      "presente": false,
      "contenuto": null,
      "note": "<perché è importante includerla>"
    }}
  ],
  "clausole_mancanti": ["<lista clausole assenti o insufficienti>"],
  "criticita": [
    {{
      "titolo": "<titolo sintetico>",
      "descrizione": "<descrizione dettagliata del problema>",
      "livello_rischio": "<basso|medio|alto|critico>",
      "raccomandazione": "<azione concreta raccomandata>"
    }}
  ],
  "punteggio_conformita": <intero 0-100>,
  "livello_rischio_generale": "<basso|medio|alto|critico>",
  "raccomandazioni": ["<raccomandazione 1>", "<raccomandazione 2>"]
}}

### Testo del contratto
---
{contract_text}
---
"""


def analyze_contract_with_ai(contract_text: str, document_name: str) -> dict:
    """
    Send contract text to Claude and return parsed analysis dict.
    Truncates at 18 000 chars to stay within token budget while keeping
    the most important parts (beginning + end of document).
    """
    MAX_CHARS = 18_000

    if len(contract_text) > MAX_CHARS:
        half = MAX_CHARS // 2
        truncated = (
            contract_text[:half]
            + "\n\n[... TESTO OMESSO PER LUNGHEZZA ...]\n\n"
            + contract_text[-half:]
        )
    else:
        truncated = contract_text

    prompt = _USER_PROMPT_TEMPLATE.format(
        clause_list=_CLAUSE_LIST,
        contract_text=truncated,
    )

    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
    message = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=4096,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    raw = message.content[0].text.strip()

    # Strip markdown code fences if the model wraps the JSON
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])

    try:
        result = json.loads(raw)
    except json.JSONDecodeError as exc:
        logger.error("AI returned invalid JSON: %s", raw[:500])
        raise ValueError(f"L'analisi AI ha restituito un formato non valido: {exc}") from exc

    return result
