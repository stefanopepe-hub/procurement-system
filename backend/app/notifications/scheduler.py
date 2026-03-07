from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy.orm import Session
from datetime import date, timedelta, datetime, timezone
from app.database import SessionLocal
from app.notifications.email import (
    send_email, build_contract_expiry_email,
    build_contract_rinegoziazione_email, build_requalification_email
)
from app.config import settings
import logging

# Thresholds (days) for which expiry alerts are sent.
# The model has explicit boolean columns for 60gg and 30gg; for 7gg and 1gg
# we track delivery via ContractCommunication to avoid adding new migrations.
CONTRACT_EXPIRY_THRESHOLDS = [60, 30, 7, 1]

logger = logging.getLogger(__name__)

scheduler = BackgroundScheduler(timezone="Europe/Rome")


def _already_sent(db, contract_id: int, tipo: str) -> bool:
    """Return True if a notification of *tipo* was already sent for this contract."""
    from app.contracts.models import ContractCommunication
    return db.query(ContractCommunication).filter(
        ContractCommunication.contract_id == contract_id,
        ContractCommunication.tipo == tipo,
        ContractCommunication.status == "sent",
    ).first() is not None


def check_contract_notifications():
    """Daily job: send expiry and renegotiation alerts for contracts.

    Thresholds covered: 60, 30, 7, 1 days before expiry / renegotiation date.
    For 60gg and 30gg the model has dedicated boolean sentinel columns; for 7gg
    and 1gg delivery is tracked via ContractCommunication rows to avoid a
    database migration.
    """
    db: Session = SessionLocal()
    try:
        from app.contracts.models import Contract, ContractCommunication
        today = date.today()

        contracts = db.query(Contract).filter(Contract.alert_enabled == True).all()

        for c in contracts:
            # --- Scadenza contratto ---
            if c.data_scadenza and not c.data_rinegoziazione:
                days_to_expiry = (c.data_scadenza - today).days

                # Use <= so that missed daily runs still trigger the notification.
                if 0 < days_to_expiry <= 60 and not c.notifica_60gg_sent:
                    _send_contract_expiry_notification(db, c, days_to_expiry)
                    c.notifica_60gg_sent = True

                if 0 < days_to_expiry <= 30 and not c.notifica_30gg_sent:
                    _send_contract_expiry_notification(db, c, days_to_expiry)
                    c.notifica_30gg_sent = True

                if 0 < days_to_expiry <= 7:
                    if not _already_sent(db, c.id, "notifica_scadenza_7gg"):
                        _send_contract_expiry_notification(db, c, days_to_expiry)

                if days_to_expiry == 1:
                    if not _already_sent(db, c.id, "notifica_scadenza_1gg"):
                        _send_contract_expiry_notification(db, c, 1)

            # --- Data rinegoziazione ---
            if c.data_rinegoziazione:
                days_to_rineg = (c.data_rinegoziazione - today).days

                if 0 < days_to_rineg <= 60 and not c.notifica_rinegoziazione_60gg_sent:
                    _send_rinegoziazione_notification(db, c, days_to_rineg)
                    c.notifica_rinegoziazione_60gg_sent = True

                if 0 < days_to_rineg <= 30 and not c.notifica_rinegoziazione_30gg_sent:
                    _send_rinegoziazione_notification(db, c, days_to_rineg)
                    c.notifica_rinegoziazione_30gg_sent = True

        db.commit()

    except Exception as e:
        logger.error(f"Contract notification job error: {e}")
        db.rollback()
    finally:
        db.close()


def _send_contract_expiry_notification(db, contract, giorni: int):
    from app.contracts.models import ContractCommunication
    html = build_contract_expiry_email(
        contract.id_contratto, contract.ragione_sociale,
        contract.oggetto, str(contract.data_scadenza), giorni
    )
    subject = f"[Alert] Contratto {contract.id_contratto} scade tra {giorni} giorni"
    success = send_email([settings.EMAIL_ALBO_FORNITORI], subject, html)

    comm = ContractCommunication(
        contract_id=contract.id,
        tipo=f"notifica_scadenza_{giorni}gg",
        oggetto=subject,
        corpo=html,
        destinatari=[settings.EMAIL_ALBO_FORNITORI],
        is_auto=True,
        status="sent" if success else "failed",
    )
    db.add(comm)
    logger.info(f"Contract expiry notification sent for {contract.id_contratto} ({giorni}gg)")


def _send_rinegoziazione_notification(db, contract, giorni: int):
    from app.contracts.models import ContractCommunication
    html = build_contract_rinegoziazione_email(
        contract.id_contratto, contract.ragione_sociale,
        contract.oggetto, str(contract.data_rinegoziazione), giorni
    )
    subject = f"[Alert] Rinegoziazione {contract.id_contratto} tra {giorni} giorni"
    success = send_email([settings.EMAIL_ALBO_FORNITORI], subject, html)

    comm = ContractCommunication(
        contract_id=contract.id,
        tipo=f"notifica_rinegoziazione_{giorni}gg",
        oggetto=subject,
        corpo=html,
        destinatari=[settings.EMAIL_ALBO_FORNITORI],
        is_auto=True,
        status="sent" if success else "failed",
    )
    db.add(comm)
    logger.info(f"Rinegoziazione notification sent for {contract.id_contratto} ({giorni}gg)")


def check_supplier_requalification():
    """Daily job: send requalification notices to suppliers"""
    db: Session = SessionLocal()
    try:
        from app.suppliers.models import Supplier, SupplierCommunication, AccreditamentType, SupplierStatus
        today = date.today()

        suppliers = db.query(Supplier).filter(
            Supplier.is_active_in_albo == True,
            Supplier.status.in_([SupplierStatus.ACCREDITATO, SupplierStatus.SOTTO_OSSERVAZIONE]),
            Supplier.accreditament_type.isnot(None),
            Supplier.data_iscrizione.isnot(None),
        ).all()

        for s in suppliers:
            mesi = 54 if s.accreditament_type == AccreditamentType.STRATEGICO else 30
            base_date = s.data_riqualifica or s.data_iscrizione
            requalification_date = _add_months(base_date, mesi)

            days_to_requalif = (requalification_date - today).days

            # Send 30 days before requalification date
            if days_to_requalif == 30:
                primary_email = _get_primary_email(s)
                if not primary_email:
                    continue

                html = build_requalification_email(
                    s.ragione_sociale,
                    s.accreditament_type.value,
                    mesi,
                    f"https://procurement.telethon.it/requalification/{s.id}"
                )
                subject = "Riqualifica Fornitore - Fondazione Telethon"
                success = send_email(
                    [primary_email],
                    subject, html,
                    cc=[settings.EMAIL_ALBO_FORNITORI]
                )

                s.status = SupplierStatus.IN_RIQUALIFICA

                comm = SupplierCommunication(
                    supplier_id=s.id,
                    tipo="riqualifica",
                    oggetto=subject,
                    corpo=html,
                    destinatari=[primary_email, settings.EMAIL_ALBO_FORNITORI],
                    inviata_at=datetime.now(timezone.utc),
                    is_auto=True,
                    status="sent" if success else "failed",
                )
                db.add(comm)
                logger.info(f"Requalification email sent to supplier {s.ragione_sociale}")

        db.commit()

    except Exception as e:
        logger.error(f"Supplier requalification job error: {e}")
        db.rollback()
    finally:
        db.close()


def cleanup_expired_tokens():
    """Weekly job: delete expired refresh tokens from DB (GDPR data retention)."""
    db: Session = SessionLocal()
    try:
        from app.auth.models import RefreshToken
        now = datetime.now(timezone.utc)
        deleted = db.query(RefreshToken).filter(
            RefreshToken.expires_at < now
        ).delete()
        db.commit()
        logger.info(f"Cleanup: eliminati {deleted} refresh token scaduti")
    except Exception as e:
        logger.error(f"Token cleanup job error: {e}")
        db.rollback()
    finally:
        db.close()


def expire_survey_tokens():
    """Daily job: mark expired survey tokens"""
    db: Session = SessionLocal()
    try:
        from app.vendor_rating.models import VendorRatingRequest
        now = datetime.now(timezone.utc)
        db.query(VendorRatingRequest).filter(
            VendorRatingRequest.survey_expires_at < now,
            VendorRatingRequest.survey_expired == False,
            VendorRatingRequest.survey_completed_at == None,
        ).update({"survey_expired": True})
        db.commit()
    except Exception as e:
        logger.error(f"Survey expiry job error: {e}")
        db.rollback()
    finally:
        db.close()


def _get_primary_email(supplier) -> str:
    for c in supplier.contacts:
        if c.is_primary and c.email1:
            return c.email1
    for c in supplier.contacts:
        if c.email1:
            return c.email1
    return None


def _add_months(d: date, months: int) -> date:
    month = d.month - 1 + months
    year = d.year + month // 12
    month = month % 12 + 1
    import calendar
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def start_scheduler():
    scheduler.add_job(
        check_contract_notifications,
        CronTrigger(hour=7, minute=0),
        id="contract_notifications",
        replace_existing=True,
    )
    scheduler.add_job(
        check_supplier_requalification,
        CronTrigger(hour=7, minute=15),
        id="supplier_requalification",
        replace_existing=True,
    )
    scheduler.add_job(
        expire_survey_tokens,
        CronTrigger(hour=0, minute=5),
        id="expire_surveys",
        replace_existing=True,
    )
    scheduler.add_job(
        cleanup_expired_tokens,
        CronTrigger(day_of_week="sun", hour=3, minute=0),
        id="cleanup_expired_tokens",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Notification scheduler started")
