# mood_map.py

# TMDB genre ids (movies)
# https://developers.themoviedb.org/3/genres/get-movie-list

MOOD_MAP = {
    "chill": {
        "genres": [35, 10749, 10402],  # Comedy, Romance, Music
        "exclude": [27, 53, 80],       # Horror, Thriller, Crime
        "why": "Chill picks lean warm + light: Comedy/Romance/Music with easy pacing."
    },
    "excited": {
        "genres": [28, 12, 53],        # Action, Adventure, Thriller
        "exclude": [10751, 16],        # Family, Animation (usually not 'excited')
        "why": "Excited boosts adrenaline: Action/Adventure/Thriller with punchy momentum."
    },
    "happy": {
        "genres": [35, 16, 10751],     # Comedy, Animation, Family
        "exclude": [27],               # Horror
        "why": "Happy goes feel-good: Comedy/Animation/Family to lift your mood."
    },
    "mindblown": {
        "genres": [878, 9648, 53],     # Sci-Fi, Mystery, Thriller
        "exclude": [10751, 16],        # Family, Animation
        "why": "Mindblown prioritizes big ideas: Sci-Fi/Mystery with twist potential."
    },
    "romantic": {
        "genres": [10749, 18],         # Romance, Drama
        "exclude": [27, 53, 28, 12],   # Horror, Thriller, Action, Adventure
        "why": "Romantic blends Romance + Drama for chemistry and emotional payoff."
    },
    "sad": {
        "genres": [18],                # Drama
        # this is what stops Harry Potter / LOTR type stuff from slipping in
        "exclude": [14, 12, 16, 10751, 35, 28, 878],  # Fantasy, Adventure, Animation, Family, Comedy, Action, Sci-Fi
        "why": "Sad picks meaningful stories: Drama with strong characters and depth."
    },
    "scared": {
        "genres": [27, 53, 9648],      # Horror, Thriller, Mystery
        "exclude": [35, 10751],        # Comedy, Family
        "why": "Scared turns up tension: Horror/Thriller/Mystery for chills."
    }
}

def list_moods():
    return list(MOOD_MAP.keys())

def mood_genres(mood: str):
    mood = (mood or "").lower().strip()
    return MOOD_MAP.get(mood, {}).get("genres", [])

def mood_excludes(mood: str):
    mood = (mood or "").lower().strip()
    return MOOD_MAP.get(mood, {}).get("exclude", [])

def mood_why(mood: str):
    mood = (mood or "").lower().strip()
    return MOOD_MAP.get(mood, {}).get("why", "Mood-based picks based on genre signals.")
