#!/usr/bin/env python3
"""
Sync / Transfer all data FROM Supabase into Local SQLite and JSON backups.

Transfers:
- `students` (IMAP accounts & encrypted tokens)
- `emails` (All parsed campus emails)
- `events` (Extracted deadlines and events)

Outputs:
1. `data/supabase_mirror.db`: Standalone SQLite database with exact Supabase tables & schemas.
2. `data/itsp.db`: Ingests into `email_students`, `emails`, and `email_events` tables.
3. `data/supabase_backup/`: Full JSON and SQL exports.
"""

import os
import sys
import json
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Add repo root to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from supabase import create_client


def fetch_all_rows(client, table_name, batch_size=1000):
    """Fetch every single row from a Supabase table using range pagination."""
    print(f"[Supabase] Fetching table '{table_name}'...")
    all_rows = []
    offset = 0

    while True:
        res = client.table(table_name).select("*").range(offset, offset + batch_size - 1).execute()
        rows = res.data or []
        if not rows:
            break
        all_rows.extend(rows)
        print(f"  - Downloaded {len(rows)} rows (total so far: {len(all_rows)})")
        if len(rows) < batch_size:
            break
        offset += batch_size

    print(f"[Supabase] Finished '{table_name}': {len(all_rows)} total records.")
    return all_rows


def create_sqlite_table(conn, table_name, sample_row):
    """Dynamically create an SQLite table matching the dictionary schema."""
    cols_def = []
    for k, v in sample_row.items():
        if k == "id":
            cols_def.append('"id" TEXT PRIMARY KEY')
        elif isinstance(v, int):
            cols_def.append(f'"{k}" INTEGER')
        elif isinstance(v, float):
            cols_def.append(f'"{k}" REAL')
        elif isinstance(v, bool):
            cols_def.append(f'"{k}" INTEGER')
        else:
            cols_def.append(f'"{k}" TEXT')

    sql = f'CREATE TABLE IF NOT EXISTS "{table_name}" (\n  ' + ",\n  ".join(cols_def) + "\n);"
    conn.execute(sql)
    conn.commit()


def insert_rows_into_sqlite(conn, table_name, rows):
    """Insert or replace rows into SQLite table."""
    if not rows:
        return

    sample = rows[0]
    create_sqlite_table(conn, table_name, sample)

    cols = list(sample.keys())
    col_str = ", ".join(f'"{c}"' for c in cols)
    placeholders = ", ".join("?" for _ in cols)

    sql = f'INSERT OR REPLACE INTO "{table_name}" ({col_str}) VALUES ({placeholders})'

    records = []
    for r in rows:
        rec = []
        for c in cols:
            val = r.get(c)
            if isinstance(val, (dict, list)):
                val = json.dumps(val)
            elif isinstance(val, bool):
                val = 1 if val else 0
            rec.append(val)
        records.append(rec)

    conn.executemany(sql, records)
    conn.commit()
    print(f"[SQLite] Ingested {len(records)} rows into '{table_name}'.")


def main():
    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("supabase_url")
    supabase_api = os.environ.get("SUPABASE_API") or os.environ.get("supabase_api")

    if not supabase_url or not supabase_api:
        print("[ERROR] SUPABASE_URL and SUPABASE_API must be set in .env", file=sys.stderr)
        sys.exit(1)

    print(f"[Init] Connecting to Supabase project: {supabase_url}")
    client = create_client(supabase_url, supabase_api)

    tables = ["students", "emails", "events"]
    data = {}

    for t in tables:
        data[t] = fetch_all_rows(client, t)

    # 1. Save JSON backups
    backup_dir = os.path.abspath("data/supabase_backup")
    os.makedirs(backup_dir, exist_ok=True)

    for t, rows in data.items():
        json_path = os.path.join(backup_dir, f"{t}.json")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(rows, f, indent=2, ensure_ascii=False)
        print(f"[Backup] Saved {len(rows)} records to {json_path}")

    # 2. Ingest into dedicated data/supabase_mirror.db
    mirror_db_path = os.path.abspath("data/supabase_mirror.db")
    print(f"\n[Mirror] Writing to dedicated SQLite mirror: {mirror_db_path}")
    mirror_conn = sqlite3.connect(mirror_db_path)
    for t, rows in data.items():
        insert_rows_into_sqlite(mirror_conn, t, rows)
    mirror_conn.close()

    # 3. Ingest into main local database data/itsp.db
    main_db_path = os.path.abspath("data/itsp.db")
    print(f"\n[Local Platform DB] Syncing into main database: {main_db_path}")
    main_conn = sqlite3.connect(main_db_path)
    # Use email_students and email_events to avoid colliding with main user tables
    insert_rows_into_sqlite(main_conn, "email_students", data["students"])
    insert_rows_into_sqlite(main_conn, "emails", data["emails"])
    insert_rows_into_sqlite(main_conn, "email_events", data["events"])
    main_conn.close()

    print("\n=======================================================")
    print("[SUCCESS] DATABASE TRANSFER FROM SUPABASE TO LOCAL COMPLETE!")
    print(f"Total students (email accounts): {len(data['students'])}")
    print(f"Total emails:                    {len(data['emails'])}")
    print(f"Total events:                    {len(data['events'])}")
    print(f"Dedicated mirror SQLite DB:      {mirror_db_path}")
    print(f"Integrated main SQLite DB:       {main_db_path}")
    print(f"Raw JSON backups:                {backup_dir}")
    print("=======================================================")


if __name__ == "__main__":
    main()
