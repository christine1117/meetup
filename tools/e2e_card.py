#!/usr/bin/env python3
"""End-to-end check on the real database, with throwaway test accounts:
A and B save cards in one competition and see each other's card (with the
public profile, as the recommendations load them); C, without a card, sees
none. The accounts are deleted afterwards. Prints statuses and the database's
own error text; nothing personal. Runs on GitHub (needs the key)."""

import os
import sys
import uuid

import httpx

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
public = "sb_publishable_SAkUJR7BS7kY1q1C5f-jow_1GNeh9wy"
admin = {"apikey": key, **({"Authorization": f"Bearer {key}"} if key.startswith("eyJ") else {})}
http = httpx.Client(timeout=30)
made = []
failed = False


def check(label, ok, detail=""):
    global failed
    print(f"{'ok  ' if ok else 'FAIL'} {label}{(': ' + detail) if detail else ''}")
    failed = failed or not ok


def account(name):
    email = f"halfsugar-test-{uuid.uuid4().hex[:8]}@example.com"
    u = http.post(f"{url}/auth/v1/admin/users", headers=admin, json={"email": email, "email_confirm": True}).json()
    made.append(u["id"])
    link = http.post(f"{url}/auth/v1/admin/generate_link", headers=admin, json={"type": "magiclink", "email": email}).json()
    token_hash = link.get("hashed_token") or (link.get("properties") or {}).get("hashed_token")
    jwt = http.post(f"{url}/auth/v1/verify", headers={"apikey": public}, json={"type": "magiclink", "token_hash": token_hash}).json()["access_token"]
    me = {"apikey": public, "Authorization": f"Bearer {jwt}", "Content-Type": "application/json"}
    r = http.post(f"{url}/rest/v1/profiles", headers={**me, "Prefer": "return=minimal"},
                  json={"id": u["id"], "alias": f"Test {name}", "field": "Design", "city": "", "meet": "both", "curious": [], "fun": ""})
    check(f"{name}: save profile", r.status_code == 201, r.text[:200])
    return u["id"], me


try:
    comp = http.get(f"{url}/rest/v1/competitions", headers={"apikey": public}, params={"select": "id", "listed": "eq.true", "limit": 1}).json()[0]["id"]
    a, as_a = account("A")
    b, as_b = account("B")
    c, as_c = account("C")
    for uid, who, roles in ((a, as_a, ["Design"]), (b, as_b, ["Frontend"])):
        r = http.post(f"{url}/rest/v1/participations", params={"select": "*"},
                      headers={**who, "Prefer": "resolution=merge-duplicates,return=representation", "Accept": "application/vnd.pgrst.object+json"},
                      json={"competition_id": comp, "user_id": uid, "offered_roles": roles, "desired_roles": [], "goal": "win", "weekly_hours": 6,
                            "idea": "", "built": "", "availability": ["mon_eve"]})
        check(f"save card {roles[0]}", r.status_code == 201, r.text[:200])
    # What the recommendations load: everyone else's card in the competition, with the public profile
    query = {"select": "*,profiles(alias,field,city)", "competition_id": f"eq.{comp}"}
    seen = http.get(f"{url}/rest/v1/participations", headers=as_a, params={**query, "user_id": f"neq.{a}"}).json()
    check("A sees B's card with B's profile", len(seen) == 1 and seen[0]["user_id"] == b and seen[0]["profiles"]["alias"] == "Test B", str(seen)[:200])
    none = http.get(f"{url}/rest/v1/participations", headers=as_c, params=query).json()
    check("C without a card sees no cards", none == [], str(none)[:200])
    edit = http.patch(f"{url}/rest/v1/participations", headers={**as_c, "Prefer": "return=representation"}, params={"user_id": f"eq.{a}"}, json={"idea": "hacked"})
    check("C cannot change A's card", edit.json() == [], edit.text[:200])
finally:
    for uid in made:
        http.delete(f"{url}/auth/v1/admin/users/{uid}", headers=admin)
    print(f"deleted {len(made)} test accounts")
sys.exit(1 if failed else 0)
