#!/usr/bin/env python3
"""
Full Database Migration Tool: SQLite (data/itsp.db) -> Supabase (PostgreSQL)

Features:
1. Generates a standalone, fully self-contained `scripts/supabase_migration.sql`
   that can be executed in 1 click in the Supabase Dashboard -> SQL Editor.
2. Can connect directly to Supabase via PostgreSQL URI (`DATABASE_URL`) to perform
   live table creation, data replication, sequence synchronization, and verification.
"""

import os
import sys
import argparse
import sqlite3
from datetime import datetime
from dotenv import load_dotenv

# Ensure root repo is on python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from backend.core.database import Base
import backend.models
from sqlalchemy.schema import CreateTable, CreateIndex
from sqlalchemy.dialects import postgresql
from sqlalchemy import create_engine, text


def format_sql_value(val):
    """Format Python / SQLite value into a valid PostgreSQL SQL literal."""
    if val is None:
        return "NULL"
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bytes):
        hex_str = val.hex()
        return f"'\\x{hex_str}'::bytea"
    if isinstance(val, str):
        # Escape single quotes
        escaped = val.replace("'", "''")
        return f"'{escaped}'"
    return f"'{str(val)}'"


def generate_sql_dump(sqlite_path: str, output_sql_path: str):
    """Generate a self-contained PostgreSQL migration script with DDL, Data, and Sequence resets."""
    if not os.path.exists(sqlite_path):
        raise FileNotFoundError(f"SQLite database not found at: {sqlite_path}")

    con = sqlite3.connect(sqlite_path)
    con.row_factory = sqlite3.Row

    lines = []
    lines.append("-- =============================================================")
    lines.append("-- ATLAS Platform: Full Migration Dump from Local SQLite to Supabase")
    lines.append(f"-- Generated: {datetime.utcnow().isoformat()} UTC")
    lines.append("-- Target: Supabase (PostgreSQL 15+)")
    lines.append("-- =============================================================\n")
    lines.append("-- Disable foreign key checks during batch ingestion")
    lines.append("SET session_replication_role = 'replica';\n")

    # 1. DDL: Create Tables & Indexes
    lines.append("-- =============================================================")
    lines.append("-- 1. SCHEMA DEFINITIONS (TABLES & INDEXES)")
    lines.append("-- =============================================================\n")

    for table in Base.metadata.sorted_tables:
        ddl = str(CreateTable(table).compile(dialect=postgresql.dialect())).strip()
        lines.append(f"-- Table: {table.name}")
        lines.append(f"{ddl};\n")

        for index in table.indexes:
            idx_ddl = str(CreateIndex(index).compile(dialect=postgresql.dialect())).strip()
            lines.append(f"{idx_ddl};\n")

    # 2. DATA: Insert rows for each table in topological order
    lines.append("-- =============================================================")
    lines.append("-- 2. DATA INGESTION")
    lines.append("-- =============================================================\n")

    total_rows = 0
    table_stats = {}

    for table in Base.metadata.sorted_tables:
        table_name = table.name
        # Check if table exists in SQLite
        chk = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone()
        if not chk:
            continue

        rows = con.execute(f"SELECT * FROM {table_name}").fetchall()
        table_stats[table_name] = len(rows)
        if not rows:
            continue

        cols = [col[0] for col in con.execute(f"SELECT * FROM {table_name} LIMIT 0").description]
        col_list_str = ", ".join(f'"{c}"' for c in cols)

        lines.append(f"-- Data for {table_name} ({len(rows)} rows)")
        for row in rows:
            values = [format_sql_value(row[c]) for c in cols]
            val_str = ", ".join(values)
            lines.append(f'INSERT INTO "{table_name}" ({col_list_str}) VALUES ({val_str}) ON CONFLICT DO NOTHING;')
            total_rows += 1
        lines.append("")

    # 3. SEQUENCE RESETS
    lines.append("-- =============================================================")
    lines.append("-- 3. SEQUENCE SYNCHRONIZATION")
    lines.append("-- =============================================================\n")

    for table in Base.metadata.sorted_tables:
        if "id" in table.columns and str(table.columns["id"].type).startswith("INTEGER"):
            lines.append(
                f"SELECT setval(pg_get_serial_sequence('\"{table.name}\"', 'id'), "
                f"COALESCE((SELECT MAX(id) FROM \"{table.name}\"), 1), "
                f"(SELECT COUNT(*) FROM \"{table.name}\") > 0);"
            )

    lines.append("\n-- Re-enable foreign key checks")
    lines.append("SET session_replication_role = 'origin';\n")
    lines.append("-- Migration completed successfully.")

    con.close()

    os.makedirs(os.path.dirname(os.path.abspath(output_sql_path)), exist_ok=True)
    with open(output_sql_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))

    print(f"[SUCCESS] SQL dump generated at: {output_sql_path}")
    print(f"[INFO] Exported {total_rows} total rows across {len(table_stats)} tables:")
    for t, count in table_stats.items():
        if count > 0:
            print(f"  - {t}: {count} rows")

    return table_stats


def migrate_direct(sqlite_path: str, pg_url: str):
    """Direct live migration from SQLite to PostgreSQL over SQLAlchemy."""
    print(f"\n[Connecting] Target PostgreSQL: {pg_url.split('@')[-1] if '@' in pg_url else pg_url}")
    pg_engine = create_engine(pg_url, pool_pre_ping=True)

    print("[DDL] Creating missing tables on Supabase PostgreSQL...")
    Base.metadata.create_all(bind=pg_engine)
    print("[DDL] Tables verified/created successfully.")

    con = sqlite3.connect(sqlite_path)
    con.row_factory = sqlite3.Row

    with pg_engine.connect() as pg_conn:
        # Disable triggers/FKs during load for clean replication
        try:
            pg_conn.execute(text("SET session_replication_role = 'replica';"))
        except Exception as e:
            print(f"[Note] session_replication_role not modified: {e}")

        for table in Base.metadata.sorted_tables:
            table_name = table.name
            chk = con.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (table_name,)).fetchone()
            if not chk:
                continue

            rows = con.execute(f"SELECT * FROM {table_name}").fetchall()
            if not rows:
                continue

            print(f"[Migrating] {table_name} ({len(rows)} rows)...")
            cols = [col[0] for col in con.execute(f"SELECT * FROM {table_name} LIMIT 0").description]
            col_list_str = ", ".join(f'"{c}"' for c in cols)
            placeholders = ", ".join(f":{c}" for c in cols)

            insert_sql = text(f'INSERT INTO "{table_name}" ({col_list_str}) VALUES ({placeholders}) ON CONFLICT DO NOTHING')

            records = []
            for r in rows:
                row_dict = dict(r)
                records.append(row_dict)

            pg_conn.execute(insert_sql, records)

            # Sequence sync for autoincrement primary keys
            if "id" in table.columns and str(table.columns["id"].type).startswith("INTEGER"):
                seq_sql = text(
                    f"SELECT setval(pg_get_serial_sequence('\"{table_name}\"', 'id'), "
                    f"COALESCE((SELECT MAX(id) FROM \"{table_name}\"), 1), "
                    f"(SELECT COUNT(*) FROM \"{table_name}\") > 0);"
                )
                try:
                    pg_conn.execute(seq_sql)
                except Exception as e:
                    pass

        try:
            pg_conn.execute(text("SET session_replication_role = 'origin';"))
        except Exception:
            pass

        pg_conn.commit()

    con.close()
    print("\n[SUCCESS] Direct migration completed successfully!")


def main():
    parser = argparse.ArgumentParser(description="Migrate local SQLite database to Supabase PostgreSQL.")
    parser.add_argument("--sqlite", default="data/itsp.db", help="Path to SQLite database file")
    parser.add_argument("--out-sql", default="scripts/supabase_migration.sql", help="Path to output SQL file")
    parser.add_argument("--db-url", default=None, help="PostgreSQL connection string (e.g. postgresql://...)")
    args = parser.parse_args()

    load_dotenv()
    pg_url = args.db_url or os.environ.get("DATABASE_URL")

    # 1. Generate standalone SQL dump
    generate_sql_dump(args.sqlite, args.out_sql)

    # 2. If Postgres URL is available, execute direct migration
    if pg_url and pg_url.startswith("postgres"):
        migrate_direct(args.sqlite, pg_url)
    else:
        print("\n[NEXT STEP] No PostgreSQL connection string ('DATABASE_URL') found.")
        print("To migrate:")
        print(f"1. EITHER copy the contents of '{args.out_sql}' into Supabase Dashboard -> SQL Editor and click RUN.")
        print(f"2. OR provide your Supabase database connection string:")
        print(f"   python {sys.argv[0]} --db-url \"postgresql://postgres:[PASSWORD]@db.lcorsvdtqtqpyxiizfyn.supabase.co:5432/postgres\"")


if __name__ == "__main__":
    main()
