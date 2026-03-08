#!/usr/bin/env python3
"""
=============================================================================
INVIA EMAIL DI TEST VENDOR RATING — pepe@tigem.it
=============================================================================
Crea una richiesta di valutazione nel DB e invia l'email al destinatario.

USO:
  cd backend
  DATABASE_URL="postgresql://procurement:test1234@localhost:5432/procurement_db" \
  SMTP_HOST="mailhog" SMTP_PORT=1025 \
  python send_test_email.py

  # Per email reale (Gmail):
  SMTP_HOST="smtp.gmail.com" SMTP_PORT=587 SMTP_TLS=true \
  SMTP_USER="tuo@gmail.com" SMTP_PASSWORD="app_password" \
  EMAIL_FROM="noreply@telethon.it" \
  python send_test_email.py --email pepe@tigem.it
=============================================================================
"""

import sys
import os
import secrets
import argparse
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, engine, Base
from app.auth.models import User
from app.suppliers.models import Supplier
from app.vendor_rating.models import VendorRatingRequest, RatingTriggerType
from app.notifications.email import send_email, build_vendor_rating_survey_email
from app.config import settings


def send_test_survey(email: str, fornitore_id: int | None = None, dry_run: bool = False):
    """Crea una survey di test e invia l'email."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # Trova fornitore
        if fornitore_id:
            supplier = db.query(Supplier).filter(Supplier.id == fornitore_id).first()
        else:
            supplier = db.query(Supplier).filter(
                Supplier.is_active_in_albo == True
            ).first()

        if not supplier:
            print("❌ Nessun fornitore trovato nel database.")
            print("   Esegui prima: python seed.py")
            return

        print(f"\n🏢 Fornitore selezionato: {supplier.ragione_sociale}")
        print(f"📧 Destinatario:          {email}")

        # Crea survey token
        token = secrets.token_urlsafe(64)
        expires = datetime.now(timezone.utc) + timedelta(days=30)

        req = VendorRatingRequest(
            supplier_id=supplier.id,
            alyante_order_id=f"TEST-{secrets.token_hex(4).upper()}",
            protocollo_ordine=f"TEST-ORD-{datetime.now().strftime('%Y%m%d-%H%M')}",
            tipo_trigger=RatingTriggerType.OPR_COMPLETATO,
            tipo_documento="OPR",
            data_ordine=date.today() - timedelta(days=3),
            data_registrazione=date.today() - timedelta(days=1),
            data_consegna_richiesta=date.today() - timedelta(days=2),
            data_consegna_ricevuta=date.today() - timedelta(days=1),
            quantita_richiesta=Decimal("50"),
            quantita_ricevuta=Decimal("50"),
            cdc_commessa="CDC001",
            responsabile="Giuseppe Pepe",
            valutatore_email=email,
            valutatore_nome="Giuseppe Pepe",
            survey_token=token,
            survey_expires_at=expires,
            survey_sent_at=None,
            survey_expired=False,
        )

        if not dry_run:
            db.add(req)
            db.commit()
            db.refresh(req)
            print(f"✅ Survey creata nel DB (id={req.id})")

        # Costruisci URL
        app_url = os.environ.get("APP_BASE_URL", settings.APP_BASE_URL)
        survey_url = f"{app_url}/survey/{token}"

        print(f"\n🔗 URL Survey: {survey_url}")

        # Costruisci email
        html = build_vendor_rating_survey_email(
            ragione_sociale=supplier.ragione_sociale,
            protocollo=req.protocollo_ordine,
            survey_url=survey_url,
            tipo_trigger="opr_completato",
            data_ordine=str(date.today() - timedelta(days=3)),
        )

        # Mostra config SMTP
        print(f"\n📮 Configurazione SMTP:")
        print(f"   Host:  {settings.SMTP_HOST}:{settings.SMTP_PORT}")
        print(f"   TLS:   {settings.SMTP_TLS}")
        print(f"   User:  {settings.SMTP_USER or '(nessuno)'}")
        print(f"   From:  {settings.EMAIL_FROM}")

        if dry_run:
            print(f"\n🔍 DRY RUN — Email non inviata, survey non salvata nel DB")
            print(f"   Corpo email salvato in: /tmp/test_email_preview.html")
            with open("/tmp/test_email_preview.html", "w") as f:
                f.write(html)
            return

        # Invia email
        print(f"\n📤 Invio email in corso...")
        success = send_email(
            to=[email],
            subject=f"⭐ Valuta la fornitura di {supplier.ragione_sociale} – Fondazione Telethon",
            body_html=html,
        )

        if success:
            req.survey_sent_at = datetime.now(timezone.utc)
            db.commit()
            print(f"✅ Email inviata con successo a {email}!")
            print(f"\n📌 Istruzioni per completare il test:")
            print(f"   1. Apri la casella {email}")
            print(f"   2. Cerca l'email con oggetto 'Valuta la fornitura di {supplier.ragione_sociale}'")
            print(f"   3. Clicca il pulsante 'Lascia la tua valutazione'")
            print(f"   4. Compila i 3 KPI con le stelline")
            print(f"   5. Invia la valutazione")
            print(f"   6. Verifica l'aggiornamento nel pannello admin: /vendor-rating")
            if "mailhog" in settings.SMTP_HOST or settings.SMTP_HOST == "localhost":
                print(f"\n⚠️  NOTA: SMTP è Mailhog → visualizza l'email su http://localhost:8025")
        else:
            print(f"❌ Invio fallito. Controlla la configurazione SMTP.")
            print(f"\n💡 Puoi testare manualmente aprendo questo URL:")
            print(f"   {survey_url}")

    except Exception as e:
        db.rollback()
        print(f"❌ Errore: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Invia email di test vendor rating")
    parser.add_argument("--email", default="pepe@tigem.it", help="Email destinatario")
    parser.add_argument("--fornitore-id", type=int, default=None, help="ID fornitore")
    parser.add_argument("--dry-run", action="store_true", help="Non salvare nel DB né inviare")
    args = parser.parse_args()

    print("=" * 60)
    print("TEST EMAIL — VENDOR RATING FONDAZIONE TELETHON")
    print("=" * 60)
    send_test_survey(
        email=args.email,
        fornitore_id=args.fornitore_id,
        dry_run=args.dry_run,
    )
