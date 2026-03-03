import os, requests
from dotenv import load_dotenv

load_dotenv()

key = os.getenv("TMDB_API_KEY") or ""
print("Loaded key length:", len(key))
print("Key preview:", key[:4] + "..." + key[-4:] if len(key) >= 8 else key)

url = "https://api.themoviedb.org/3/movie/top_rated"
res = requests.get(url, params={"api_key": key, "page": 1})

print("Status:", res.status_code)
print("Response:", res.json())
