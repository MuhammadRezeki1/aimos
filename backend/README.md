# AIMOS Scraping Backend

FastAPI backend for AIMOS social media scraping engines.

## Structure

- `scraping/engine_tiktok` contains the TikTok scraping API and engine files.
- `scraping/engine_instagram`, `scraping/engine_twitter`, and `scraping/engine_facebook` are placeholders for future engines.

## Run

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python -m playwright install chromium
uvicorn main:app --reload --port 8000
```

During development, TikTok search subprocess scripts are written to the OS temp
directory (`%TEMP%\aimos_tiktok_search_tmp`) so `uvicorn --reload` does not
restart the API while a scraping job is running.

## TikTok keyword endpoint

```http
POST http://localhost:8000/api/tiktok/search/keyword
Content-Type: application/json

{
  "keyword": "pemilu",
  "max_posts": 30,
  "max_hashtags": 5
}
```
