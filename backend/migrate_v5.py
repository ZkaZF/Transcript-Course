"""Migration V5 — Tambah kolom 'notes' untuk fitur Catatan Manual."""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcript.db")
print(f"Database: {db_path}")

if not os.path.exists(db_path):
    print("Database not found, will be created on first run (notes column included automatically).")
else:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()

    cols = [col[1] for col in c.execute("PRAGMA table_info(sessions)").fetchall()]
    print(f"Existing columns: {cols}")

    if "notes" not in cols:
        c.execute('ALTER TABLE sessions ADD COLUMN notes TEXT DEFAULT ""')
        print("  Added column: notes")
    else:
        print("  Column already exists: notes")

    conn.commit()
    conn.close()
    print("Migration V5 complete!")
