"""The database files exist, and every column the crawler writes is created by them.
(If a migration file goes missing, or the crawler starts writing a new column,
this fails before anything is saved to the real database.)"""

import re
from pathlib import Path

from crawler.extract.schema import Decision, RawCompetition, Track
from crawler.run import listing_record
from crawler.store.supabase_store import db_rows

MIGRATIONS = Path(__file__).resolve().parents[2] / "supabase" / "migrations"


def columns() -> dict[str, set[str]]:
    sql = "\n".join(p.read_text("utf8") for p in sorted(MIGRATIONS.glob("*.sql")))
    out: dict[str, set[str]] = {}
    for table, body in re.findall(r"create table if not exists (\w+) \(([\s\S]*?)\n\);", sql):
        out.setdefault(table, set()).update(re.findall(r"^\s+(\w+)\s+(?:text|int|bigint|boolean|jsonb|uuid|timestamptz)", body, re.M))
    for table, col in re.findall(r"alter table (\w+) add column if not exists (\w+)", sql):
        out.setdefault(table, set()).add(col)
    return out


def test_migration_files_are_there():
    names = sorted(p.name for p in MIGRATIONS.glob("*.sql"))
    assert names[:3] == ["0001_competitions.sql", "0002_profiles.sql", "0003_categories_and_languages.sql"], names


def test_every_column_the_crawler_writes_exists():
    raw = RawCompetition(id="dp-1", source="devpost", region="intl", kind="Hackathon", name="H", url="https://x.dev")
    d = Decision(status="published", listed=True, tracks=[Track(max=4, evidence="q")])
    row = db_rows(raw, d, listing_record(raw, d))
    have = columns()
    assert set(row["competition"]) <= have["competitions"], set(row["competition"]) - have["competitions"]
    assert set(row["tracks"][0]) | {"competition_id"} <= have["competition_team_rules"], set(row["tracks"][0]) - have["competition_team_rules"]
    assert {"issue", "detail", "competition_id"} <= have["extraction_reviews"]
