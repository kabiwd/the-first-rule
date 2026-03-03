# The First Rule — Mood-Based Movie Recommender

A Flask-based movie recommendation web app that suggests movies based on user mood using the TMDB API.

## Features
- Mood-based movie recommendations
- Dynamic movie discovery
- Simple web interface
- Database-backed movie handling

## Tech Stack
- Python
- Flask
- SQLite
- HTML
- CSS
- JavaScript
- TMDB API

## Project Structure
- `app.py` – main Flask app
- `db.py` – database operations
- `mood_map.py` – mood mapping logic
- `templates/` – HTML templates
- `static/` – CSS/JS
- `data/` – local data files

## Setup
1. Clone the repository
2. Create and activate a virtual environment
3. Install dependencies:
   `pip install -r requirements.txt`
4. Create a `.env` file from `.env.example`
5. Add your TMDB API key
6. Run:
   `python app.py`

## Environment Variable
- `TMDB_API_KEY`

## Screenshots

### Home Dashboard
![Home Dashboard](screenshots/home-dashboard.png)

### Swipe Recommendation
![Swipe Recommendation](screenshots/swipe-recommendation.png)

### Movie Preview Modal
![Movie Preview Modal](screenshots/movie-preview-modal.png)

### Watchlist
![Watchlist](screenshots/watchlist-page.png)
