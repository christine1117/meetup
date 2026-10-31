#!/usr/bin/env python3
"""How many accounts, profiles and participation cards the database has, and
when people last signed in. Counts and times only: no emails or names are
printed. Runs on GitHub (Actions > Check the database), where the key is."""

import os
import sys

import httpx

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers = {"apikey": key}
if key.startswith("eyJ"):
    headers["Authorization"] = f"Bearer {key}"


def count(table: str) -> str:
    r = httpx.head(f"{url}/rest/v1/{table}", params={"select": "*"}, headers={**headers, "Prefer": "count=exact"}, timeout=30)
    if r.is_error:
        return f"error {r.status_code}"
    return r.headers.get("content-range", "?/?").split("/")[-1]


users = httpx.get(f"{url}/auth/v1/admin/users", params={"per_page": 1000}, headers=headers, timeout=30)
if users.is_error:
    print(f"Accounts: error {users.status_code} {users.text[:200]}")
else:
    people = users.json().get("users", [])
    print(f"Accounts: {len(people)}")
    for i, u in enumerate(sorted(people, key=lambda u: u.get('created_at') or ''), 1):
        providers = ",".join((u.get("app_metadata") or {}).get("providers") or [])
        print(f"  #{i} via {providers or '?'}; created {u.get('created_at', '?')[:16]}; last sign-in {(u.get('last_sign_in_at') or 'never')[:16]}")
for table in ("profiles", "profile_sealed", "participations"):
    print(f"{table}: {count(table)} rows")
sys.exit(0)
