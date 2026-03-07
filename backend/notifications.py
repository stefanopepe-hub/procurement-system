"""
notifications.py – Public API for SMTP email notifications.

Provides high-level helper functions used by routes and scheduled tasks:
  - send_contract_expiry_email(contract, days_left)
  - send_supplier_approval_email(supplier, approved)

SMTP configuration is read from environment variables:
  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM (alias EMAIL_FROM)

The low-level send_email() transport and HTML builders live in
app/notifications/email.py; this module wraps them with business logic.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from app.config import settings
from app.notifications.email import send_email

if TYPE_CHECKING:
    from app.contracts.models import Contract
    from app.suppliers.models import Supplier

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Contract expiry notification
# ---------------------------------------------------------------------------

def send_contract_expiry_email(contract: "Contract", days_left: int) -> bool:
    """Send an expiry-alert email for *contract* expiring in *days_left* days.

    Intended to be called for days_left in {30, 7, 1} as well as any other
    threshold configured by the scheduler.

    Returns True if the email was accepted by the SMTP server, False otherwise.
    """
    subject = (
        f"[Alert] Contratto {contract.id_contratto} scade tra {days_left} "
        f"{'giorno' if days_left == 1 else 'giorni'}"
    )

    html = _build_contract_expiry_html(contract, days_left)

    recipients = [settings.EMAIL_ALBO_FORNITORI]
    success = send_email(recipients, subject, html)

    if success:
        logger.info(
            "Contract expiry email sent: contract=%s days_left=%d",
            contract.id_contratto, days_left,
        )
    else:
        logger.error(
            "Failed to send contract expiry email: contract=%s days_left=%d",
            contract.id_contratto, days_left,
        )

    return success


def _build_contract_expiry_html(contract: "Contract", days_left: int) -> str:
    urgency_color = "#d4380d" if days_left <= 7 else "#fa8c16" if days_left <= 30 else "#1677ff"
    data_scadenza = str(contract.data_scadenza) if contract.data_scadenza else "N/D"
    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <div style="background:{urgency_color};color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="margin:0;">Alert Scadenza Contratto</h2>
        <p style="margin:4px 0 0;opacity:.9;">Fondazione Telethon – Ufficio Acquisti</p>
      </div>
      <div style="border:1px solid #e8e8e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p>Il contratto riportato di seguito scadrà tra
           <strong style="color:{urgency_color};">{days_left}
           {'giorno' if days_left == 1 else 'giorni'}</strong>.</p>
        <table border="1" cellpadding="10" cellspacing="0"
               style="border-collapse:collapse;width:100%;margin:16px 0;">
          <tr style="background:#fafafa;">
            <td><strong>ID Contratto</strong></td>
            <td>{contract.id_contratto}</td>
          </tr>
          <tr>
            <td><strong>Fornitore</strong></td>
            <td>{contract.ragione_sociale}</td>
          </tr>
          <tr style="background:#fafafa;">
            <td><strong>Oggetto</strong></td>
            <td>{contract.oggetto}</td>
          </tr>
          <tr>
            <td><strong>Data Scadenza</strong></td>
            <td><strong style="color:{urgency_color};">{data_scadenza}</strong></td>
          </tr>
        </table>
        <p>Si prega di procedere al rinnovo o alla chiusura del contratto prima della scadenza.</p>
        <p style="font-size:12px;color:#888;">
          Per assistenza: <a href="mailto:{settings.EMAIL_ALBO_FORNITORI}">{settings.EMAIL_ALBO_FORNITORI}</a>
        </p>
      </div>
      <p style="font-size:11px;color:#bbb;text-align:center;margin-top:12px;">
        Fondazione Telethon – Ufficio Acquisti
      </p>
    </body>
    </html>
    """


# ---------------------------------------------------------------------------
# Supplier approval notification
# ---------------------------------------------------------------------------

def send_supplier_approval_email(supplier: "Supplier", approved: bool = True) -> bool:
    """Send an approval / rejection notification to the supplier's primary contact.

    Parameters
    ----------
    supplier:
        SQLAlchemy Supplier instance (must have ``contacts`` loaded).
    approved:
        True  → supplier has been approved / accredited.
        False → supplier has been rejected / removed from the albo.

    Returns True if the email was accepted by the SMTP server, False otherwise.
    """
    primary_email = _get_supplier_primary_email(supplier)
    if not primary_email:
        logger.warning(
            "Cannot send approval email: no primary email for supplier %s (id=%s)",
            supplier.ragione_sociale, supplier.id,
        )
        return False

    if approved:
        subject = "Approvazione Iscrizione Albo Fornitori – Fondazione Telethon"
    else:
        subject = "Esito Iscrizione Albo Fornitori – Fondazione Telethon"

    html = _build_supplier_approval_html(supplier, approved)

    recipients = [primary_email]
    cc = [settings.EMAIL_ALBO_FORNITORI]
    success = send_email(recipients, subject, html, cc=cc)

    if success:
        logger.info(
            "Supplier approval email sent: supplier=%s approved=%s to=%s",
            supplier.ragione_sociale, approved, primary_email,
        )
    else:
        logger.error(
            "Failed to send supplier approval email: supplier=%s approved=%s",
            supplier.ragione_sociale, approved,
        )

    return success


def _build_supplier_approval_html(supplier: "Supplier", approved: bool) -> str:
    if approved:
        header_color = "#52c41a"
        header_title = "Iscrizione Approvata"
        body_text = (
            f"Siamo lieti di comunicarle che la sua richiesta di iscrizione all'Albo Fornitori "
            f"della Fondazione Telethon è stata <strong>approvata</strong>."
        )
        detail_text = (
            "Da oggi potrà essere invitato a partecipare alle procedure di acquisto "
            "della Fondazione Telethon. Qualora i suoi dati o documenti necessitino "
            "di aggiornamenti, potrà procedere tramite il portale fornitori."
        )
    else:
        header_color = "#d4380d"
        header_title = "Iscrizione Non Approvata"
        body_text = (
            f"Siamo spiacenti di comunicarle che la sua richiesta di iscrizione all'Albo Fornitori "
            f"della Fondazione Telethon non ha ricevuto approvazione in questa fase."
        )
        detail_text = (
            "Per conoscere le motivazioni o per ulteriori informazioni, la invitiamo a "
            "contattare l'Ufficio Acquisti all'indirizzo indicato in calce."
        )

    return f"""
    <html>
    <body style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
      <div style="background:{header_color};color:#fff;padding:20px;border-radius:8px 8px 0 0;text-align:center;">
        <h2 style="margin:0;">Albo Fornitori – {header_title}</h2>
        <p style="margin:4px 0 0;opacity:.9;">Fondazione Telethon</p>
      </div>
      <div style="border:1px solid #e8e8e8;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
        <p>Gentile <strong>{supplier.ragione_sociale}</strong>,</p>
        <p>{body_text}</p>
        <p>{detail_text}</p>
        <p style="font-size:12px;color:#888;">
          Per assistenza contattare l'Ufficio Acquisti:
          <a href="mailto:{settings.EMAIL_ALBO_FORNITORI}">{settings.EMAIL_ALBO_FORNITORI}</a>
        </p>
      </div>
      <p style="font-size:11px;color:#bbb;text-align:center;margin-top:12px;">
        Fondazione Telethon – Ufficio Acquisti
      </p>
    </body>
    </html>
    """


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_supplier_primary_email(supplier: "Supplier") -> str | None:
    """Return the primary contact email address for *supplier*, or None."""
    for contact in supplier.contacts:
        if contact.is_primary and contact.email1:
            return contact.email1
    for contact in supplier.contacts:
        if contact.email1:
            return contact.email1
    return None
