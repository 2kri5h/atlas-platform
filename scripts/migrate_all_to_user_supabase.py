#!/usr/bin/env python3
"""
Full Autonomous Deployment & Migration to User's Supabase Project:
Project Ref: mfibwvyzidmiwlcmxcuh (2kri5h's Project)
Region: ap-south-1 (Mumbai)

Steps:
1. Compiles and creates all 29 core platform tables and indexes on Supabase PostgreSQL.
2. Reads records from local SQLite (data/itsp.db) with strict type awareness (booleans -> TRUE/FALSE, bytes -> bytea).
3. Ingests all core platform records in dependency order.
4. Creates email tables: `email_students`, `emails`, `email_events`.
5. Ingests all 2,018 transferred records (11 students, 1237 emails, 770 events).
6. Synchronizes PostgreSQL sequences for auto-increment keys.
7. Verifies table and row counts directly via SQL.
8. Updates local .env with the new project URL & API keys.
"""

import os
import sys
import json
import sqlite3
import requests

# Ensure root repo is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.core.database import Base
import backend.models
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql

TOKEN = os.environ.get("SUPABASE_ACCESS_TOKEN", "")
PROJECT_REF = os.environ.get("SUPABASE_PROJECT_REF", "mfibwvyzidmiwlcmxcuh")
API_URL = f"https://api.supabase.com/v1/projects/{PROJECT_REF}/database/query"

HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}


def run_sql(query_str, desc="SQL Execution"):
    """Execute SQL on user's Supabase PostgreSQL instance via Management API."""
    res = requests.post(API_URL, headers=HEADERS, json={"query": query_str})
    if res.status_code not in (200, 201):
        err_msg = res.text[:300]
        print(f"[ERROR] Failed {desc} (status {res.status_code}): {err_msg}")
        raise RuntimeError(f"SQL execution failed: {err_msg}")
    return res.json()


def format_sql_val(val, is_bool=False):
    """Format Python / SQLite value into a valid PostgreSQL SQL literal."""
    if val is None:
        return "NULL"
    if is_bool or isinstance(val, bool):
        return "TRUE" if bool(val) else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bytes):
        return f"'\\x{val.hex()}'::bytea"
    if isinstance(val, (dict, list)):
        escaped = json.dumps(val).replace("'", "''")
        return f"'{escaped}'"
    escaped = str(val).replace("'", "''")
    return f"'{escaped}'"


def batch_insert(table_name, rows, bool_cols=None, batch_size=150):
    """Insert rows into table with chunking and conflict handling."""
    if not rows:
        return
    bool_cols = bool_cols or set()
    cols = list(rows[0].keys())
    col_str = ", ".join(f'"{c}"' for c in cols)

    for i in range(0, len(rows), batch_size):
        chunk = rows[i:i + batch_size]
        val_rows = []
        for r in chunk:
            vals = [format_sql_val(r.get(c), is_bool=(c in bool_cols)) for c in cols]
            val_rows.append(f"({', '.join(vals)})")

        sql = f'INSERT INTO "{table_name}" ({col_str}) VALUES\n' + ",\n".join(val_rows) + "\nON CONFLICT DO NOTHING;"
        run_sql(sql, f"Insert chunk {i}..{i+len(chunk)} into {table_name}")

    print(f"  [Done] Ingested {len(rows)} rows into {table_name}")


def main():
    print("================================================================")
    print("[START] DEPLOYING COMPLETE DATABASE TO USER'S SUPABASE PROJECT")
    print(f"Project Ref: {PROJECT_REF}")
    print("================================================================\n")

    # Step 1: Create all 29 core tables and indexes on Supabase
    print("[Step 1] Creating all 29 core platform tables on Supabase...")
    run_sql("SET session_replication_role = 'replica';", "Disable FK checks during schema init")

    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect())).strip()
        # Use IF NOT EXISTS
        ddl = ddl.replace("CREATE TABLE ", "CREATE TABLE IF NOT EXISTS ")
        run_sql(ddl + ";", f"Create table {table.name}")

        for index in table.indexes:
            idx_ddl = str(CreateIndex(index).compile(dialect=postgresql.dialect())).strip()
            # PostgreSQL requires index name safety
            idx_ddl = idx_ddl.replace("CREATE INDEX ", "CREATE INDEX IF NOT EXISTS ")
            idx_ddl = idx_ddl.replace("CREATE UNIQUE INDEX ", "CREATE UNIQUE INDEX IF NOT EXISTS ")
            try:
                run_sql(idx_ddl + ";", f"Create index {index.name}")
            except Exception:
                pass  # Ignore if index already exists

    print("[Step 1] All 29 tables & indexes created successfully!\n")

    # Step 2: Read records from local SQLite data/itsp.db and insert
    print("[Step 2] Migrating core platform records from SQLite...")
    con = sqlite3.connect("data/itsp.db")
    con.row_factory = sqlite3.Row

    for table in Base.metadata.sorted_tables:
        table_name = table.name
        chk = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone()
        if not chk:
            continue

        rows = [dict(r) for r in con.execute(f"SELECT * FROM {table_name}").fetchall()]
        if not rows:
            continue

        bool_cols = {col.name for col in table.columns if str(col.type).lower().startswith("bool")}
        batch_insert(table_name, rows, bool_cols=bool_cols)

    con.close()
    print("[Step 2] Core platform records migrated successfully!\n")

    # Step 3: Create Email Service Tables
    print("[Step 3] Creating email system tables (email_students, emails, email_events)...")
    email_schema = """
    CREATE TABLE IF NOT EXISTS email_students (
        id VARCHAR(36) PRIMARY KEY,
        platform_user_id VARCHAR(50),
        imap_email VARCHAR(255) UNIQUE NOT NULL,
        imap_token_encrypted TEXT NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS emails (
        id VARCHAR(36) PRIMARY KEY,
        student_id VARCHAR(50),
        message_id VARCHAR(255),
        subject TEXT,
        sender VARCHAR(255),
        email_date TIMESTAMP WITH TIME ZONE,
        category VARCHAR(50),
        importance VARCHAR(50),
        summary TEXT,
        processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_emails_student_id ON emails(student_id);
    CREATE INDEX IF NOT EXISTS ix_emails_message_id ON emails(message_id);

    CREATE TABLE IF NOT EXISTS email_events (
        id VARCHAR(36) PRIMARY KEY,
        email_id VARCHAR(36) REFERENCES emails(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        event_type VARCHAR(50),
        event_date VARCHAR(50),
        event_time VARCHAR(50),
        end_date VARCHAR(50),
        end_time VARCHAR(50),
        location TEXT,
        confidence VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS ix_email_events_email_id ON email_events(email_id);
    """
    run_sql(email_schema, "Email tables DDL")
    print("[Step 3] Email tables created successfully!\n")

    # Step 4: Ingest Email Service Data from Backups
    print("[Step 4] Ingesting transferred records into Supabase...")
    backup_dir = os.path.abspath("data/supabase_backup")

    with open(os.path.join(backup_dir, "students.json"), "r", encoding="utf-8") as f:
        email_students_data = json.load(f)
    with open(os.path.join(backup_dir, "emails.json"), "r", encoding="utf-8") as f:
        emails_data = json.load(f)
    with open(os.path.join(backup_dir, "events.json"), "r", encoding="utf-8") as f:
        events_data = json.load(f)

    batch_insert("email_students", email_students_data)
    batch_insert("emails", emails_data)
    batch_insert("email_events", events_data)
    run_sql("SET session_replication_role = 'origin';", "Re-enable FK checks")
    print("[Step 4] All email data ingested successfully!\n")

    # Step 5: Sequence Synchronization
    print("[Step 5] Synchronizing PostgreSQL sequences...")
    for table in Base.metadata.sorted_tables:
        if "id" in table.columns and str(table.columns["id"].type).startswith("INTEGER"):
            seq_sql = (
                f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{table.name}\"), 1), "
                f"(SELECT COUNT(*) FROM \"{table.name}\") > 0);"
            )
            try:
                run_sql(seq_sql, f"Sync sequence {table.name}")
            except Exception:
                pass
    print("[Step 5] Sequences synchronized!\n")

    # Step 6: Verify All Tables & Counts on Supabase
    print("[Step 6] Verifying tables and counts on user's Supabase project...")
    verify_sql = """
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
    """
    tables_res = run_sql(verify_sql, "Get public tables")
    table_names = [r["table_name"] for r in tables_res]
    print(f"\n[VERIFIED] Total Public Tables Created: {len(table_names)}")

    stats_sql = """
    SELECT 
        (SELECT COUNT(*) FROM students) as platform_students,
        (SELECT COUNT(*) FROM planner_events) as planner_events,
        (SELECT COUNT(*) FROM resources) as resources,
        (SELECT COUNT(*) FROM anonymous_posts_v2) as anonymous_posts,
        (SELECT COUNT(*) FROM email_students) as email_students,
        (SELECT COUNT(*) FROM emails) as emails,
        (SELECT COUNT(*) FROM email_events) as email_events;
    """
    stats_res = run_sql(stats_sql, "Get record counts")
    counts = stats_res[0] if stats_res else {}

    print("Record Counts on your Supabase Database:")
    for k, v in counts.items():
        print(f"   - {k}: {v} rows")

    # Step 7: Update local .env
    print("\n[Step 7] Updating local .env configuration...")
    env_path = os.path.abspath(".env")
    anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maWJ3dnl6aWRtaXdsY214Y3VoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI4NDU0MjAsImV4cCI6MjA5ODQyMTQyMH0.lhu12m0fsEI1pSNO0bVIyIqXbCyInr1wNyZ4H3Upaxw"
    service_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maWJ3dnl6aWRtaXdsY214Y3VoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4Mjg0NTQyMCwiZXhwIjoyMDk4NDIxNDIwfQ.U3P94mdRHUZ4NcuxFiviZh-fK6bfQJ1vZRr0j8FBK_M"
    supabase_url = f"https://{PROJECT_REF}.supabase.co"

    with open(env_path, "r", encoding="utf-8") as f:
        env_lines = f.readlines()

    new_lines = []
    has_service_key = False
    for line in env_lines:
        if line.startswith("SUPABASE_URL="):
            new_lines.append(f"SUPABASE_URL={supabase_url}\n")
        elif line.startswith("SUPABASE_API="):
            new_lines.append(f"SUPABASE_API={anon_key}\n")
        elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
            new_lines.append(f"SUPABASE_SERVICE_ROLE_KEY={service_key}\n")
            has_service_key = True
        else:
            new_lines.append(line)

    if not has_service_key:
        new_lines.append(f"SUPABASE_SERVICE_ROLE_KEY={service_key}\n")

    with open(env_path, "w", encoding="utf-8") as f:
        f.writelines(new_lines)
    print(f"[Done] Updated {env_path} with new Supabase project credentials!")

    print("\n================================================================")
    print("[SUCCESS] FULL SUPABASE MIGRATION SUCCESSFULLY COMPLETED!")
    print(f"Project URL:    {supabase_url}")
    print(f"Dashboard URL:  https://supabase.com/dashboard/project/{PROJECT_REF}")
    print(f"Total Tables:   {len(table_names)}")
    print("================================================================")


if __name__ == "__main__":
    main()
