# app.py
import os
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request

from mood_map import list_moods, mood_genres, mood_why
import db

load_dotenv()

TMDB_API_KEY = os.getenv("TMDB_API_KEY", "").strip()
if not TMDB_API_KEY:
    print("WARNING: TMDB_API_KEY missing. Put it in .env")

TMDB_BASE = "https://api.themoviedb.org/3"

# English-only
FORCED_LANG = "en"
LANGUAGE_PARAM = "en-US"

app = Flask(__name__)
db.init_db()


def tmdb_get(path: str, params: dict = None):
    params = params or {}
    params["api_key"] = TMDB_API_KEY
    url = f"{TMDB_BASE}{path}"
    r = requests.get(url, params=params, timeout=12)
    r.raise_for_status()
    return r.json()


def safe_int(x, default=None):
    try:
        return int(x)
    except:
        return default


@app.get("/")
def home():
    return render_template("index.html")


@app.get("/top")
def top():
    return render_template("top.html")


# ✅ NEW pages
@app.get("/watchlist")
def watchlist_page():
    return render_template("watchlist.html")


@app.get("/skipped")
def skipped_page():
    return render_template("skipped.html")


@app.get("/api/moods")
def api_moods():
    return jsonify({"moods": list_moods()})


def discover_call(
    mood: str,
    page: int,
    year_from=None,
    year_to=None,
    liked_genres=None,
    vote_gte=1200,
    vote_avg_gte=6.2,
    sort_by="vote_average.desc",
    use_mood_genres=True
):
    liked_genres = liked_genres or []
    genres = mood_genres(mood) if use_mood_genres else []

    params = {
        "language": LANGUAGE_PARAM,
        "sort_by": sort_by,
        "include_adult": "false",
        "include_video": "false",
        "page": page,
        "with_original_language": FORCED_LANG,
    }

    if vote_gte is not None:
        params["vote_count.gte"] = int(vote_gte)

    if vote_avg_gte is not None:
        params["vote_average.gte"] = float(vote_avg_gte)

    # year filter via release date range
    if year_from:
        params["primary_release_date.gte"] = f"{year_from}-01-01"
    if year_to:
        params["primary_release_date.lte"] = f"{year_to}-12-31"

    # blend mood + taste
    combined = []
    if genres:
        combined.extend(genres)
    if liked_genres:
        combined.extend(liked_genres)

    if combined:
        seen = set()
        final = []
        for g in combined:
            if g not in seen:
                seen.add(g)
                final.append(g)
        params["with_genres"] = ",".join(str(g) for g in final)

    return tmdb_get("/discover/movie", params=params)


@app.get("/api/recommend")
def api_recommend():
    mood = (request.args.get("mood") or "").lower().strip()
    page = safe_int(request.args.get("page"), 1) or 1

    year_from = safe_int(request.args.get("year_from"), None)
    year_to = safe_int(request.args.get("year_to"), None)

    liked_raw = (request.args.get("liked_genres") or "").strip()
    liked_genres = []
    if liked_raw:
        for part in liked_raw.split(","):
            g = safe_int(part, None)
            if g is not None:
                liked_genres.append(g)

    try:
        strict = discover_call(
            mood=mood, page=page,
            year_from=year_from, year_to=year_to,
            liked_genres=liked_genres,
            vote_gte=1200, vote_avg_gte=6.2,
            sort_by="vote_average.desc",
            use_mood_genres=True
        )

        results = strict.get("results", []) or []
        merged = {m.get("id"): m for m in results if m.get("id")}

        if len(merged) < 10:
            loose = discover_call(
                mood=mood, page=page,
                year_from=year_from, year_to=year_to,
                liked_genres=liked_genres,
                vote_gte=250, vote_avg_gte=5.8,
                sort_by="popularity.desc",
                use_mood_genres=True
            )
            for m in (loose.get("results", []) or []):
                mid = m.get("id")
                if mid and mid not in merged:
                    merged[mid] = m

        if len(merged) < 10:
            broad = discover_call(
                mood=mood, page=page,
                year_from=year_from, year_to=year_to,
                liked_genres=[],
                vote_gte=80, vote_avg_gte=None,
                sort_by="popularity.desc",
                use_mood_genres=False
            )
            for m in (broad.get("results", []) or []):
                mid = m.get("id")
                if mid and mid not in merged:
                    merged[mid] = m

        final_results = list(merged.values())

        explain = mood_why(mood)
        if liked_genres:
            explain += " Then I blended your top-liked genres into the pool for taste learning."
        if year_from or year_to:
            explain += f" Year range: {year_from or '…'} → {year_to or '…'}."
        explain += " English-only mode enabled."
        if len(results) < 10:
            explain += " (Auto-relaxed filters to avoid empty queues.)"

        total_pages = min(int(strict.get("total_pages", 1)), 500)

        return jsonify({
            "page": int(strict.get("page", page)),
            "total_pages": total_pages,
            "results": final_results,
            "explain": explain
        })

    except requests.exceptions.RequestException as e:
        return jsonify({"error": "TMDB request failed", "detail": str(e)}), 502


@app.get("/api/toprated")
def api_toprated():
    page = safe_int(request.args.get("page"), 1) or 1
    year_from = safe_int(request.args.get("year_from"), None)
    year_to = safe_int(request.args.get("year_to"), None)

    try:
        params = {
            "language": LANGUAGE_PARAM,
            "sort_by": "vote_average.desc",
            "include_adult": "false",
            "include_video": "false",
            "page": page,
            "with_original_language": FORCED_LANG,
            "vote_count.gte": 2500,
            "vote_average.gte": 7.5,
        }
        if year_from:
            params["primary_release_date.gte"] = f"{year_from}-01-01"
        if year_to:
            params["primary_release_date.lte"] = f"{year_to}-12-31"

        data = tmdb_get("/discover/movie", params=params)
        return jsonify({
            "page": data.get("page", page),
            "total_pages": min(int(data.get("total_pages", 1)), 500),
            "results": data.get("results", [])
        })
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "TMDB request failed", "detail": str(e)}), 502


@app.get("/api/search")
def api_search():
    q = (request.args.get("q") or "").strip()
    page = safe_int(request.args.get("page"), 1) or 1
    year_from = safe_int(request.args.get("year_from"), None)
    year_to = safe_int(request.args.get("year_to"), None)

    if not q:
        return jsonify({"page": page, "total_pages": 1, "results": []})

    try:
        params = {
            "language": LANGUAGE_PARAM,
            "query": q,
            "include_adult": "false",
            "page": page,
        }
        if year_from:
            params["primary_release_year"] = year_from

        data = tmdb_get("/search/movie", params=params)
        results = data.get("results", []) or []
        results = [m for m in results if (m.get("original_language") == "en")]

        if year_to:
            def y(m):
                try:
                    return int((m.get("release_date") or "0000")[:4])
                except:
                    return 0
            results = [m for m in results if y(m) <= year_to]

        return jsonify({
            "page": data.get("page", page),
            "total_pages": min(int(data.get("total_pages", 1)), 500),
            "results": results
        })
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "TMDB request failed", "detail": str(e)}), 502


@app.get("/api/trailer")
def api_trailer():
    movie_id = request.args.get("id")
    if not movie_id:
        return jsonify({"youtube_key": None})

    try:
        data = tmdb_get(f"/movie/{movie_id}/videos", params={"language": LANGUAGE_PARAM})
        vids = data.get("results", []) or []
        candidates = [v for v in vids if v.get("site") == "YouTube"]
        trailer = next((v for v in candidates if v.get("type") == "Trailer"), None)
        if not trailer and candidates:
            trailer = candidates[0]
        return jsonify({"youtube_key": trailer.get("key") if trailer else None})
    except requests.exceptions.RequestException:
        return jsonify({"youtube_key": None})


@app.get("/api/providers")
def api_providers():
    movie_id = request.args.get("id")
    region = (request.args.get("region") or "IN").upper()

    if not movie_id:
        return jsonify({"error": "Missing id"}), 400

    try:
        data = tmdb_get(f"/movie/{movie_id}/watch/providers")
        results = (data.get("results") or {})
        reg = results.get(region) or {}

        providers = []
        for bucket in ("flatrate", "rent", "buy"):
            for p in (reg.get(bucket) or []):
                providers.append({
                    "type": bucket,
                    "provider_name": p.get("provider_name"),
                    "logo_path": p.get("logo_path"),
                })

        seen_names = set()
        unique = []
        for p in providers:
            name = p.get("provider_name")
            if not name or name in seen_names:
                continue
            seen_names.add(name)
            unique.append(p)

        return jsonify({"region": region, "link": reg.get("link"), "providers": unique})
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "TMDB request failed", "detail": str(e)}), 502


@app.get("/api/watchlist")
def api_watchlist():
    return jsonify({"items": db.list_watchlist()})


@app.post("/api/watchlist/add")
def api_watchlist_add():
    payload = request.get_json(force=True) or {}
    if "id" not in payload:
        return jsonify({"ok": False, "error": "Missing id"}), 400

    db.add_watchlist(payload)
    db.log_swipe(payload["id"], "like", mood=None)
    return jsonify({"ok": True})


@app.post("/api/watchlist/remove")
def api_watchlist_remove():
    payload = request.get_json(force=True) or {}
    movie_id = payload.get("id")
    if not movie_id:
        return jsonify({"ok": False, "error": "Missing id"}), 400

    db.remove_watchlist(movie_id)
    return jsonify({"ok": True})


# ✅ NEW: swipe logging endpoint (your script.js needs this)
@app.post("/api/swipe")
def api_swipe():
    payload = request.get_json(force=True) or {}
    action = (payload.get("action") or "").strip().lower()
    movie_id = payload.get("id")

    if not action or not movie_id:
        return jsonify({"ok": False, "error": "Missing action/id"}), 400

    mood = payload.get("mood")
    db.log_swipe(movie_id, action, mood=mood)

    if action == "skip":
        db.add_skipped(payload)

    return jsonify({"ok": True})


# ✅ NEW: skipped endpoints (your script.js needs these)
@app.get("/api/skipped")
def api_skipped():
    return jsonify({"items": db.list_skipped()})


@app.post("/api/skipped/clear")
def api_skipped_clear():
    db.clear_skipped()
    return jsonify({"ok": True})


if __name__ == "__main__":
    app.run(debug=True)
