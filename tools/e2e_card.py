#!/usr/bin/env python3
"""End-to-end check of saving a participation card on the real database:
a throwaway test account signs in, saves its profile and a card the way the
website does, reads it back, and is deleted again. Prints statuses and the
database's own error text; nothing personal. Runs on GitHub (needs the key)."""

import os
import sys
import uuid

import httpx

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
public = os.environ.get("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_SAkUJR7BS7kY1q1C5f-jow_1GNeh9wy")
admin = {"apikey": key, **({"Authorization": f"Bearer {key}"} if key.startswith("eyJ") else {})}
email = f"halfsugar-test-{uuid.uuid4().hex[:8]}@example.com"
http = httpx.Client(timeout=30)


def show(step, r):
    print(f"{step}: {r.status_code} {r.text[:300]}")
    return r


user = show("create test account", http.post(f"{url}/auth/v1/admin/users", headers=admin, json={"email": email, "email_confirm": True}))
uid = user.json().get("id")
try:
    link = show("make a sign-in link", http.post(f"{url}/auth/v1/admin/generate_link", headers=admin, json={"type": "magiclink", "email": email}))
    token_hash = link.json().get("hashed_token") or (link.json().get("properties") or {}).get("hashed_token")
    session = show("sign in with it", http.post(f"{url}/auth/v1/verify", headers={"apikey": public}, json={"type": "magiclink", "token_hash": token_hash}))
    jwt = session.json().get("access_token")
    if not jwt:
        sys.exit("No session: cannot test as a signed-in user")
    me = {"apikey": public, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}
    comp = http.get(f"{url}/rest/v1/competitions", headers={"apikey": public}, params={"select": "id", "listed": "eq.true", "limit": 1}).json()[0]["id"]
    show("save profile", http.post(f"{url}/rest/v1/profiles", headers={**me, "Prefer": "resolution=merge-duplicates,return=minimal"},
                                   json={"id": uid, "alias": "Test", "field": "Design", "city": "", "meet": "both", "curious": [], "fun": ""}))
    row = {"competition_id": comp, "user_id": uid, "offered_roles": ["Design"], "desired_roles": [], "goal": "win", "weekly_hours": 6,
           "idea": "", "built": "", "availability": ["mon_eve"]}
    # The website: upsert(...).select().single()
    show("save card (like the website)", http.post(f"{url}/rest/v1/participations", params={"select": "*"},
                                                   headers={**me, "Prefer": "resolution=merge-duplicates,return=representation", "Accept": "application/vnd.pgrst.object+json"}, json=row))
    show("read my cards", http.get(f"{url}/rest/v1/participations", headers=me, params={"select": "competition_id,offered_roles", "user_id": f"eq.{uid}"}))
finally:
    if uid:
        show("delete test account", http.delete(f"{url}/auth/v1/admin/users/{uid}", headers=admin))
