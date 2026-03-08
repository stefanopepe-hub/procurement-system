import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)


_SMTP_PLACEHOLDER_HOSTS = {"", "smtp.example.com", "localhost"}


def send_email(to: List[str], subject: str, body_html: str, cc: Optional[List[str]] = None) -> bool:
    # If SMTP is not configured, log and skip gracefully without raising.
    if not settings.SMTP_HOST or settings.SMTP_HOST in _SMTP_PLACEHOLDER_HOSTS:
        logger.warning(
            "SMTP non configurato (SMTP_HOST=%r). Email non inviata | Subject: %s | To: %s",
            settings.SMTP_HOST, subject, to,
        )
        return False

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
        "ddt_beni": "registrazione DDT beni",
        "ft_beni_osd": "registrazione fattura",
        "opr_completato": "completamento ordine previsionale",
    }
    evento = trigger_labels.get(tipo_trigger, "evento ordine")
    data_row = f"""
        <tr>
          <td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Data ordine</td>
          <td style="padding:6px 12px;font-weight:600;font-size:14px;border-bottom:1px solid #eee;">{data_ordine}</td>
        </tr>""" if data_ordine else ""

    return f"""<!DOCTYPE html>
<html lang="it">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f0f4f8;font-family:'Segoe UI',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f4f8;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0"
       style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;
              overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

  <!-- Header gradient Telethon -->
  <tr>
    <td style="background:linear-gradient(135deg,#1a3a5c 0%,#c0392b 100%);
               padding:36px 40px;text-align:center;">
      <div style="font-size:11px;letter-spacing:3px;color:rgba(255,255,255,0.6);
                  text-transform:uppercase;margin-bottom:8px;">Fondazione Telethon</div>
      <div style="font-size:26px;font-weight:800;color:#ffffff;margin-bottom:4px;">
        Valutazione Fornitura
      </div>
      <div style="font-size:13px;color:rgba(255,255,255,0.75);">
        Ufficio Acquisti · Sistema Procurement
      </div>
    </td>
  </tr>

  <!-- Corpo -->
  <tr>
    <td style="padding:36px 40px;">
      <p style="font-size:16px;color:#1a3a5c;font-weight:600;margin:0 0 6px;">Gentile Collega,</p>
      <p style="font-size:15px;color:#555;line-height:1.65;margin:0 0 24px;">
        A seguito della <strong style="color:#1a3a5c;">{evento}</strong> per il fornitore
        <strong style="color:#1a3a5c;">{ragione_sociale}</strong>,
        ti chiediamo di dedicare <strong>2 minuti</strong> per valutare la qualità della fornitura.
      </p>

      <!-- Info ordine -->
      <table cellpadding="0" cellspacing="0" width="100%"
             style="background:#f8faff;border-radius:10px;margin-bottom:28px;overflow:hidden;">
        <tr>
          <td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Fornitore</td>
          <td style="padding:6px 12px;font-weight:700;font-size:14px;border-bottom:1px solid #eee;
                     color:#1a3a5c;">{ragione_sociale}</td>
        </tr>
        <tr>
          <td style="padding:6px 12px;color:#666;font-size:14px;border-bottom:1px solid #eee;">Rif. ordine</td>
          <td style="padding:6px 12px;font-weight:600;font-size:14px;border-bottom:1px solid #eee;">
            {protocollo}</td>
        </tr>
        {data_row}
      </table>

      <!-- 3 KPI da valutare -->
      <p style="font-size:12px;font-weight:700;color:#1a3a5c;letter-spacing:2px;
                text-transform:uppercase;margin:0 0 14px;">Criteri di valutazione (1–5 stelle)</p>

      <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:32px;">
        <tr>
          <td style="padding:12px 16px;background:#f0f4ff;border-radius:8px;margin-bottom:8px;">
            <span style="font-size:20px;">⭐</span>
            <strong style="font-size:14px;color:#1a3a5c;vertical-align:middle;">
              KPI 1 — Qualità della fornitura
            </strong><br>
            <span style="font-size:13px;color:#777;padding-left:28px;">
              Conformità e qualità di prodotti/servizi ricevuti
            </span>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#f0f4ff;border-radius:8px;">
            <span style="font-size:20px;">⏱</span>
            <strong style="font-size:14px;color:#1a3a5c;vertical-align:middle;">
              KPI 2 — Rispetto delle tempistiche di consegna
            </strong><br>
            <span style="font-size:13px;color:#777;padding-left:28px;">
              Puntualità rispetto alle date concordate
            </span>
          </td>
        </tr>
        <tr><td style="height:8px;"></td></tr>
        <tr>
          <td style="padding:12px 16px;background:#f0f4ff;border-radius:8px;">
            <span style="font-size:20px;">💬</span>
            <strong style="font-size:14px;color:#1a3a5c;vertical-align:middle;">
              KPI 3 — Comunicazione e supporto del fornitore
            </strong><br>
            <span style="font-size:13px;color:#777;padding-left:28px;">
              Disponibilità e chiarezza nella gestione della fornitura
            </span>
          </td>
        </tr>
      </table>

      <!-- CTA -->
      <div style="text-align:center;margin:0 0 28px;">
        <a href="{survey_url}"
           style="display:inline-block;padding:18px 48px;
                  background:#1a3a5c;color:#ffffff;
                  border-radius:12px;text-decoration:none;
                  font-size:17px;font-weight:700;letter-spacing:0.3px;">
          ⭐&nbsp;&nbsp;Lascia la tua valutazione
        </a>
      </div>

      <p style="font-size:13px;color:#999;text-align:center;line-height:1.7;margin:0;">
        Il link è <strong>personale</strong> e scadrà dopo <strong>30 giorni</strong>.<br>
        Difficoltà? Scrivi a:
        <a href="mailto:{settings.EMAIL_ALBO_FORNITORI}" style="color:#1a3a5c;font-weight:600;">
          {settings.EMAIL_ALBO_FORNITORI}
        </a>
      </p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="background:#1a3a5c;padding:20px 40px;text-align:center;">
      <p style="color:rgba(255,255,255,0.6);font-size:12px;margin:0;line-height:1.6;">
        <strong style="color:rgba(255,255,255,0.9);">Fondazione Telethon</strong> · Ufficio Acquisti<br>
        I dati sono trattati nel rispetto del GDPR – Reg. UE 2016/679
      </p>
    </td>
  </tr>

</table>
</td></tr>
</table>
</body></html>"""
