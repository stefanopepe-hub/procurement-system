"""
Script di bootstrap: crea l'utente Super Admin iniziale.
Eseguire una volta sola:
  docker compose exec backend python create_admin.py
"""
import os, sys
sys.path.insert(0, os.path.dirname(__file__))

from app.database import Base, engine, SessionLocal
from app.auth.models import User, UserRole
from app.auth.utils import get_password_hash, validate_password_strength

def main():
    print("=== Procurement System – Creazione Super Admin ===")

    email = input("Email: ").strip()
    username = input("Username: ").strip()
    full_name = input("Nome completo: ").strip()
    password = input("Password (min 12 char, maiusc/minusc/numero/speciale): ").strip()

    if not validate_password_strength(password):
        print("ERROR: Password non soddisfa i requisiti di sicurezza NIS2.")
        sys.exit(1)

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    if db.query(User).filter(User.email == email).first():
        print("ERROR: Email già registrata.")
        db.close()
        sys.exit(1)

    user = User(
        email=email,
        username=username,
        full_name=full_name,
        hashed_password=get_password_hash(password),
        role=UserRole.SUPER_ADMIN,
        is_active=True,
        is_verified=True,
    )
    db.add(user)
    db.commit()
    db.close()

    print(f"\nSuper Admin '{username}' creato con successo!")
    print("Accedere all'applicazione e creare gli altri utenti dalla sezione Amministrazione.")

if __name__ == "__main__":
    main()
