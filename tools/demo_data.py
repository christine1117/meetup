#!/usr/bin/env python3
"""Demo people in the database, to try the recommendations before real people
sign up. Each is a real account with a made-up email (demo-…@example.com),
marked demo: true, with a profile, sealed details and a participation card in
every competition someone (not a demo) has a card in, or the first listed
competition if nobody has one yet.

  python tools/demo_data.py seed    add them (skipped if they are already there)
  python tools/demo_data.py clean   delete every demo account (their profiles and cards go with them)

Runs on GitHub (Actions > Demo data), where the key is."""

import os
import sys
import uuid

import httpx

url = os.environ["SUPABASE_URL"].rstrip("/")
key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
admin = {"apikey": key, "Content-Type": "application/json", **({"Authorization": f"Bearer {key}"} if key.startswith("eyJ") else {})}
http = httpx.Client(timeout=30)

PEOPLE = [
    # alias, field, city, fun fact, sealed details, card (curious-about topics are in CURIOUS below)
    ("Kite", "Engineering", "Taipei", "Has tried every bubble tea shop on one street", ("林凱文", "Frontend engineer", "NTU", "", "instagram", "@kite.dev"),
     dict(offered_roles=["Frontend"], desired_roles=["Design"], goal="win", weekly_hours=6, availability=["sat_am", "sat_pm", "sun_pm"],
          idea="做一個學校附近空氣品質的即時地圖", built="一個 2,000 人在用的公車 App")),
    ("Pim", "Research", "Hsinchu", "Measures air at home for fun", ("鄒庭安", "Research assistant", "NTHU", "", "linkedin", "in/pim-tsou"),
     dict(offered_roles=["Backend", "Data"], desired_roles=["Design", "Pitch"], goal="win", weekly_hours=10, availability=["sat_am", "wed_eve"],
          idea="", built="開源的室內空氣資料集")),
    ("Nori", "Content", "Taichung", "Writes a newsletter on Sundays", ("黃珮珊", "Writer", "Tunghai", "", "instagram", "@nori.writes"),
     dict(offered_roles=["Writing", "Pitch"], desired_roles=[], goal="learn", weekly_hours=3, availability=[], idea="", built="")),
    ("Sol", "Founder", "Taipei", "Ran a savings app in college", ("陳郁婷", "Founder", "NCCU", "Sol Labs", "linkedin", "in/sol-chen"),
     dict(offered_roles=["Pitch", "Product"], desired_roles=["Frontend", "Backend"], goal="win", weekly_hours=6,
          availability=["mon_eve", "wed_eve", "sat_pm"], idea="幫小店做會員集點的工具", built="儲蓄 App，每週 1,300 人使用")),
    ("Juno", "Engineering", "Tainan", "Builds keyboards", ("郭怡君", "Student", "NCKU", "", "instagram", "@juno.codes"),
     dict(offered_roles=["Frontend"], desired_roles=[], goal="learn", weekly_hours=10, availability=["tue_eve", "thu_eve", "sun_am"],
          idea="", built="幫三家在地小店做過網站")),
    ("Rue", "Design", "Taipei", "Draws on the MRT", ("吳若希", "Product designer", "Shih Chien", "", "instagram", "@rue.design"),
     dict(offered_roles=["Design", "Frontend"], desired_roles=["Backend"], goal="win", weekly_hours=10, availability=["sat_am", "sat_pm"],
          idea="", built="刺青師預約 App，35 人在候補名單")),
    ("Tavi", "Engineering", "Taipei", "Fixes old radios", ("許志豪", "Hardware engineer", "NYCU", "", "linkedin", "in/tavi-hsu"),
     dict(offered_roles=["Backend", "Hardware"], desired_roles=["Product"], goal="experience", weekly_hours=3, availability=["fri_eve"],
          idea="用感測器做教室二氧化碳警示", built="")),
    ("Ode", "Business", "Taichung", "Knows every farmer's market", ("賴柏睿", "Business student", "Tunghai", "", "instagram", "@ode.farm"),
     dict(offered_roles=["Marketing", "Pitch"], desired_roles=["Data"], goal="learn", weekly_hours=6, availability=["sun_pm", "sun_eve"],
          idea="把小農直送做成訂閱制", built="供貨給 9 家餐廳的小農平台")),
]


# "Curious about" on each profile (the same choices as the sign-up form)
CURIOUS = {
    'Kite': ['AI products', 'Software development', 'Sustainability', 'Music'],
    'Pim': ['Data analysis', 'Climate tech', 'Health tech'],
    'Nori': ['Writing', 'Content creation', 'Education', 'Music'],
    'Sol': ['Startups', 'Fintech', 'Small business', 'Marketing'],
    'Juno': ['Software development', 'Game development', 'Music'],
    'Rue': ['Product design', 'UI/UX design', 'Art & illustration', 'Travel'],
    'Tavi': ['Hardware', 'Robotics', 'Climate tech'],
    'Ode': ['Agriculture', 'Food', 'Small business', 'Social impact'],
}


def check(r, what):
    if r.is_error:
        sys.exit(f"{what}: HTTP {r.status_code} {r.text[:300]}")
    return r


def demo_accounts():
    users = check(http.get(f"{url}/auth/v1/admin/users", headers=admin, params={"per_page": 1000}), "list accounts").json().get("users", [])
    return [u for u in users if (u.get("user_metadata") or {}).get("demo")], [u["id"] for u in users if not (u.get("user_metadata") or {}).get("demo")]


def clean():
    demos, _ = demo_accounts()
    for u in demos:
        check(http.delete(f"{url}/auth/v1/admin/users/{u['id']}", headers=admin), "delete a demo account")
    print(f"Deleted {len(demos)} demo accounts (their profiles and cards went with them).")


def seed():
    demos, real = demo_accounts()
    if demos:
        print(f"{len(demos)} demo accounts are already there; run clean first to start over.")
        return
    cards = check(http.get(f"{url}/rest/v1/participations", headers=admin, params={"select": "competition_id,user_id"}), "read cards").json()
    comps = sorted({c["competition_id"] for c in cards if c["user_id"] in real})
    if not comps:
        comps = [check(http.get(f"{url}/rest/v1/competitions", headers=admin, params={"select": "id", "listed": "eq.true", "limit": 1}), "find a competition").json()[0]["id"]]
    for alias, field, city, fun, (name, title, school, company, ctype, contact), card in PEOPLE:
        email = f"demo-{alias.lower()}-{uuid.uuid4().hex[:6]}@example.com"
        u = check(http.post(f"{url}/auth/v1/admin/users", headers=admin, json={"email": email, "email_confirm": True, "user_metadata": {"demo": True}}), "make an account").json()
        check(http.post(f"{url}/rest/v1/profiles", headers={**admin, "Prefer": "return=minimal"},
                        json={"id": u["id"], "alias": alias, "field": field, "city": city, "meet": "both", "curious": CURIOUS.get(alias, []), "fun": fun}), "save a profile")
        check(http.post(f"{url}/rest/v1/profile_sealed", headers={**admin, "Prefer": "return=minimal"},
                        json={"id": u["id"], "real_name": name, "job_title": title, "school": school, "company": company, "contact_type": ctype, "contact": contact}), "save sealed details")
        check(http.post(f"{url}/rest/v1/participations", headers={**admin, "Prefer": "return=minimal"},
                        json=[{"competition_id": c, "user_id": u["id"], **card} for c in comps]), "save cards")
    print(f"Added {len(PEOPLE)} demo people with cards in {len(comps)} competition(s): {', '.join(comps)}")


if __name__ == "__main__":
    {"seed": seed, "clean": clean}[sys.argv[1] if len(sys.argv) > 1 else "seed"]()
