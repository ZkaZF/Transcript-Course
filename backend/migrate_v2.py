"""Migration script to add V2 columns to the sessions table."""
import sqlite3
import os

db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "transcript.db")
print(f"Database: {db_path}")

if not os.path.exists(db_path):
    print("Database not found, will be created on first run.")
else:
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # Get existing columns
    cols = [col[1] for col in c.execute("PRAGMA table_info(sessions)").fetchall()]
    print(f"Existing columns: {cols}")
    
    # Add new V2 columns if not present
    new_cols = {
        "language": 'ALTER TABLE sessions ADD COLUMN language TEXT DEFAULT "auto"',
        "material_path": 'ALTER TABLE sessions ADD COLUMN material_path TEXT DEFAULT ""',
        "material_text": 'ALTER TABLE sessions ADD COLUMN material_text TEXT DEFAULT ""',
        "transcript_segments": 'ALTER TABLE sessions ADD COLUMN transcript_segments TEXT DEFAULT ""',  # V3
    }
    
    for col_name, sql in new_cols.items():
        if col_name not in cols:
            c.execute(sql)
            print(f"  Added column: {col_name}")
        else:
            print(f"  Column already exists: {col_name}")
    
    conn.commit()
    conn.close()
    print("Migration complete!")
