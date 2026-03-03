# db.py
import sqlite3
from datetime import datetime

DB_PATH = "movies.db"

def conn():
    return sqlite3.connect(DB_PATH)

def init_db():
    with conn() as c:
        cur = c.cursor()

        cur.execute("""
        CREATE TABLE IF NOT EXISTS watchlist (
            movie_id INTEGER PRIMARY KEY,
            title TEXT,
            poster_path TEXT,
            vote_average REAL,
            added_at TEXT
        )
        """)

        cur.execute("""
        CREATE TABLE IF NOT EXISTS swipes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            movie_id INTEGER,
            action TEXT,
            mood TEXT,
            created_at TEXT
        )
        """)

        # NEW: skipped items table
        cur.execute("""
        CREATE TABLE IF NOT EXISTS skipped (
            movie_id INTEGER PRIMARY KEY,
            title TEXT,
            poster_path TEXT,
            vote_average REAL,
            mood TEXT,
            skipped_at TEXT
        )
        """)

        c.commit()

# ---- swipes ----
def log_swipe(movie_id, action, mood=None):
    with conn() as c:
        c.execute(
            "INSERT INTO swipes(movie_id, action, mood, created_at) VALUES(?,?,?,?)",
            (int(movie_id), str(action), mood, datetime.now().strftime("%Y-%m-%d %H:%M"))
        )
        c.commit()

# ---- watchlist ----
def add_watchlist(payload):
    mid = int(payload["id"])
    title = payload.get("title") or ""
    poster_path = payload.get("poster_path") or ""
    vote_average = payload.get("vote_average")

    with conn() as c:
        c.execute("""
            INSERT OR REPLACE INTO watchlist(movie_id, title, poster_path, vote_average, added_at)
            VALUES(?,?,?,?,?)
        """, (mid, title, poster_path, vote_average, datetime.now().strftime("%Y-%m-%d %H:%M")))
        c.commit()

def remove_watchlist(movie_id):
    with conn() as c:
        c.execute("DELETE FROM watchlist WHERE movie_id=?", (int(movie_id),))
        c.commit()

def list_watchlist():
    with conn() as c:
        rows = c.execute("""
            SELECT movie_id, title, poster_path, vote_average, added_at
            FROM watchlist
            ORDER BY added_at DESC
        """).fetchall()

    return [
        {
            "id": r[0],
            "title": r[1],
            "poster_path": r[2],
            "vote_average": r[3],
            "added_at": r[4]
        }
        for r in rows
    ]

# ---- skipped ----
def add_skipped(payload):
    mid = int(payload["id"])
    title = payload.get("title") or ""
    poster_path = payload.get("poster_path") or ""
    vote_average = payload.get("vote_average")
    mood = payload.get("mood")

    with conn() as c:
        c.execute("""
            INSERT OR REPLACE INTO skipped(movie_id, title, poster_path, vote_average, mood, skipped_at)
            VALUES(?,?,?,?,?,?)
        """, (mid, title, poster_path, vote_average, mood, datetime.now().strftime("%Y-%m-%d %H:%M")))
        c.commit()

def list_skipped():
    with conn() as c:
        rows = c.execute("""
            SELECT movie_id, title, poster_path, vote_average, mood, skipped_at
            FROM skipped
            ORDER BY skipped_at DESC
        """).fetchall()

    return [
        {
            "id": r[0],
            "title": r[1],
            "poster_path": r[2],
            "vote_average": r[3],
            "mood": r[4],
            "skipped_at": r[5]
        }
        for r in rows
    ]

def clear_skipped():
    with conn() as c:
        c.execute("DELETE FROM skipped")
        c.commit()
