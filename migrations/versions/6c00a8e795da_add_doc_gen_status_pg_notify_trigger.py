"""add_doc_gen_status_pg_notify_trigger

Install PostgreSQL LISTEN/NOTIFY trigger function and trigger that fires
on changes to the `document_generations` table, publishing payloads
to the existing `source_status_updates` channel.

Trigger function:  notify_doc_gen_status_update
Trigger:           doc_gen_status_trigger

Revision ID: 6c00a8e795da
Revises: 9f49ed675936
Create Date: 2026-05-31 16:41:00.000000
"""
from pathlib import Path
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6c00a8e795da"
down_revision: Union[str, Sequence[str], None] = "9f49ed675936"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Resolve SQL directory relative to this file so the migration works
# regardless of the working directory from which `alembic` is invoked:
#
#   migrations/versions/6c00a8e795da_....py  ← __file__
#   migrations/versions/                      ← parents[0]
#   migrations/                               ← parents[1]
#   graphlm-fastapi/                          ← parents[2]  (project root)
#   graphlm-fastapi/app/db/sql/               ← SQL_DIR
#
_SQL_DIR = Path(__file__).resolve().parents[2] / "app" / "db" / "sql"


def upgrade() -> None:
    sql = (_SQL_DIR / "doc_gen_status_triggers.sql").read_text()
    op.execute(sql)


def downgrade() -> None:
    sql = (_SQL_DIR / "doc_gen_status_triggers_teardown.sql").read_text()
    op.execute(sql)
