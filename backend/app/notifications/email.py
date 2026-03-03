import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def send_email(to: List[str], subject: str, body_html: str, cc: Optional[List[str]] = None) -> bool:
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_FROM
        msg["To"] = ", ".join(to)
        if cc:
            msg["Cc"] = ", ".join(cc)

        msg.attach(MIMEText(body_html, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            if settings.SMTP_TLS:
                server.starttls()
            if settings.SMTP_USER and settings.SMTP_PASSWORD:
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            recipients = to + (cc or [])
            server.sendmail(settings.EMAIL_FROM, recipients, msg.as_string())

        logger.info(f"Email sent to {to} | Subject: {subject}")
        return True

    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def build_requalification_email(ragione_sociale: str, tipo: str, mesi: int, survey_url: str) -> str:
    return f"""
    <html><body>
    <h2>Riqualifica Fornitore - Fondazione Telethon</h2>
    <p>Gentile <strong>{ragione_sociale}</strong>,</p>
    <p>La informiamo che è prevista la riqualifica periodica per i fornitori <strong>{tipo}</strong>
    (ogni {mesi} mesi).</p>
    <p>La preghiamo di aggiornare i suoi dati e documenti accedendo al seguente link:</p>
    <p><a href="{survey_url}" style="padding:10px 20px;background:#1677ff;color:#fff;border-radius:4px;text-decoration:none;">
    Accedi alla riqualifica</a></p>
    <p>Per assistenza contattare: <a href="mailto:{settings.EMAIL_ALBO_FORNITORI}">{settings.EMAIL_ALBO_FORNITORI}</a></p>
    <hr><p><small>Fondazione Telethon - Ufficio Acquisti</small></p>
    </body></html>
    """


def build_contract_expiry_email(id_contratto: str, ragione_sociale: str, oggetto: str,
                                  data_scadenza: str, giorni: int) -> str:
    return f"""
    <html><body>
    <h2>Alert Scadenza Contratto - Fondazione Telethon</h2>
    <p>Il contratto riportato di seguito scadrà tra <strong>{giorni} giorni</strong>.</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;">
      <tr><td><strong>ID Contratto</strong></td><td>{id_contratto}</td></tr>
      <tr><td><strong>Fornitore</strong></td><td>{ragione_sociale}</td></tr>
      <tr><td><strong>Oggetto</strong></td><td>{oggetto}</td></tr>
      <tr><td><strong>Data Scadenza</strong></td><td>{data_scadenza}</td></tr>
    </table>
    <p>Si prega di procedere al rinnovo o alla chiusura del contratto.</p>
    <hr><p><small>Fondazione Telethon - Ufficio Acquisti</small></p>
    </body></html>
    """


def build_contract_rinegoziazione_email(id_contratto: str, ragione_sociale: str, oggetto: str,
                                         data_rinegoziazione: str, giorni: int) -> str:
    return f"""
    <html><body>
    <h2>Alert Rinegoziazione Contratto - Fondazione Telethon</h2>
    <p>Il contratto riportato di seguito prevede una data di rinegoziazione tra <strong>{giorni} giorni</strong>.</p>
    <table border="1" cellpadding="8" style="border-collapse:collapse;">
      <tr><td><strong>ID Contratto</strong></td><td>{id_contratto}</td></tr>
      <tr><td><strong>Fornitore</strong></td><td>{ragione_sociale}</td></tr>
      <tr><td><strong>Oggetto</strong></td><td>{oggetto}</td></tr>
      <tr><td><strong>Data Rinegoziazione</strong></td><td>{data_rinegoziazione}</td></tr>
    </table>
    <p>Si prega di avviare le trattative per la rinegoziazione.</p>
    <hr><p><small>Fondazione Telethon - Ufficio Acquisti</small></p>
    </body></html>
    """


def build_vendor_rating_survey_email(
    ragione_sociale: str,
    protocollo: str,
    survey_url: str,
    tipo_trigger: str = "",
    data_ordine: str = None,
) -> str:
    trigger_labels = {
        "ddt_beni": "registrazione DDT",
        "ft_beni_osd": "registrazione fattura",
        "opr_completato": "completamento ordine previsionale",
    }
    evento = trigger_labels.get(tipo_trigger, "evento ordine")
    data_info = f"<p><strong>Data ordine:</strong> {data_ordine}</p>" if data_ordine else ""
    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <div style="background:#1677ff;color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
      <h2 style="margin:0;">Fondazione Telethon</h2>
      <p style="margin:4px 0 0;opacity:.85;">Valutazione Fornitura</p>
    </div>
    <div style="border:1px solid #e8e8e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
      <p>Gentile Collega,</p>
      <p>A seguito della <strong>{evento}</strong> per il fornitore
         <strong>{ragione_sociale}</strong>
         (Rif. ordine: <strong>{protocollo}</strong>),
         ti chiediamo di dedicare 2 minuti alla valutazione della fornitura.
      </p>
      {data_info}
      <p>Le tue valutazioni ci aiutano a monitorare la qualità dei nostri fornitori.</p>
      <div style="text-align:center;margin:32px 0;">
        <a href="{survey_url}"
           style="display:inline-block;padding:14px 32px;background:#52c41a;color:#fff;
                  border-radius:6px;text-decoration:none;font-size:16px;font-weight:bold;">
          ⭐ Valuta la fornitura
        </a>
      </div>
      <p style="font-size:12px;color:#888;">
        Il link è personale e scadrà dopo 30 giorni dall'invio.<br>
        In caso di difficoltà contatta: <a href="mailto:{settings.EMAIL_ALBO_FORNITORI}">{settings.EMAIL_ALBO_FORNITORI}</a>
      </p>
    </div>
    <p style="font-size:11px;color:#bbb;text-align:center;margin-top:12px;">
      Fondazione Telethon – Ufficio Acquisti
    </p>
    </body></html>
    """
