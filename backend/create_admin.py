"""Create the first administrator interactively. Run from the backend folder: python create_admin.py"""
from getpass import getpass
from sqlalchemy import select
from app.database import Base, engine, SessionLocal
from app.models import User
from app.security import hash_password

Base.metadata.create_all(bind=engine)
email = input("Administrator email: ").strip().lower()
name = input("Administrator full name: ").strip() or "AquaSentinel Administrator"
password = getpass("New administrator password (8+ chars, number and special character): ")
if len(password) < 8 or not any(c.isdigit() for c in password) or not any(not c.isalnum() for c in password):
    raise SystemExit("Password must be 8+ characters and contain a number and special character.")
with SessionLocal() as db:
    if db.scalar(select(User).where(User.email == email)):
        raise SystemExit("That email already exists.")
    db.add(User(full_name=name, email=email, password_hash=hash_password(password), role="admin", account_status="active"))
    db.commit()
print("Administrator created. Keep the credentials private.")
