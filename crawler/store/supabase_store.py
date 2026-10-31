"""Step 5: save into the database (Supabase / Postgres), when it is set up.

Uses Supabase's REST API with the service role key, which only lives in
GitHub secrets (never in the website). Tables: see supabase/migrations.
The website reads published competitions through row-level security rules,
so it can never see the review list or anything not published."""

from __future__ import annotations

import httpx


def check(r: httpx.Response, table: str) -> None:
    """Fail with the database's own explanation, so the run log says what went wrong."""
    if r.is_error:
        raise RuntimeError(f"{table}: HTTP {r.status_code} {r.text[:400]}")


class SupabaseStore:
    def __init__(self, url: str, service_key: str, client: httpx.Client | None = None):
        self.client = client or httpx.Client(timeout=30)
        self.base = url.rstrip("/") + "/rest/v1"
        # Older "service_role" keys are JWTs and also go in Authorization; newer
        # "sb_secret_..." keys are not JWTs and only go in the apikey header
        self.headers = {"apikey": service_key, "Content-Type": "application/json"}
        if service_key.startswith("eyJ"):
            self.headers["Authorization"] = f"Bearer {service_key}"

    def _post(self, table: str, rows: list[dict], upsert: bool = True) -> None:
        if not rows:
            return
        prefer = "resolution=merge-duplicates,return=minimal" if upsert else "return=minimal"
        r = self.client.post(f"{self.base}/{table}", json=rows, headers={**self.headers, "Prefer": prefer})
        check(r, table)

    def _delete(self, table: str, column: str, ids: list[str]) -> None:
        if ids:
            r = self.client.delete(f"{self.base}/{table}", params={column: f"in.({','.join(ids)})"}, headers=self.headers)
            check(r, table)

    def save(self, rows: list[dict]) -> None:
        """rows: one per competition: {competition: {...}, tracks: [...], issues: [...]}"""
        comps = [r["competition"] for r in rows]
        ids = [c["id"] for c in comps]
        self._post("competitions", comps)
        # Rules and open issues are replaced on every run
        self._delete("competition_team_rules", "competition_id", ids)
        self._post("competition_team_rules", [{**t, "competition_id": r["competition"]["id"]} for r in rows for t in r["tracks"]], upsert=False)
        self._delete("extraction_reviews", "competition_id", ids)
        self._post("extraction_reviews", [{**i, "competition_id": r["competition"]["id"]} for r in rows for i in r["issues"]], upsert=False)


    def unlist_missing(self, sources: list[str], seen: list[str]) -> None:
        """Competitions a source no longer lists (ended, or taken down) stop being listed.
        Only for sources read this run: a source that failed keeps its rows as they are."""
        if not sources:
            return
        params = {"source": f"in.({','.join(sources)})", "listed": "eq.true"}
        if seen:
            params["id"] = f"not.in.({','.join(seen)})"
        r = self.client.patch(f"{self.base}/competitions", params=params, json={"listed": False},
                              headers={**self.headers, "Prefer": "return=minimal"})
        check(r, "competitions")


def db_rows(raw, decision, record: dict) -> dict:
    """The database shape for one competition (record: what the website gets, from run.listing_record)."""
    return {
        "competition": {
            "id": raw.id, "source": raw.source, "region": record["region"], "kind": record["kind"], "name": raw.name,
            "organizer": raw.organizer, "url": raw.url, "start_at": raw.start, "end_at": raw.end,
            "deadline_at": raw.deadline, "location": raw.where, "tags": raw.tags, "prize": raw.prize,
            "summary": raw.summary, "eligibility": decision.eligibility,
            "eligibility_evidence": decision.eligibility_evidence,
            "status": decision.status, "listed": decision.listed,
            "category": record["category"], "i18n": record["i18n"],
        },
        "tracks": [{"track": t.name, "min_members": t.min, "max_members": t.max, "individual_allowed": t.solo,
                    "mentors_max": t.mentors, "evidence": t.evidence, "unlimited": bool(t.unlimited), "track_en": t.name_en, "track_zh": t.name_zh,
                    "evidence_en": t.evidence_en, "evidence_zh": t.evidence_zh} for t in decision.tracks],
        "issues": [{"issue": i.code, "detail": i.detail} for i in decision.issues],
    }
