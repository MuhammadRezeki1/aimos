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

## PostgreSQL import flow

1. Create a database in pgAdmin named `aimos`.
2. Copy `.env.example` to `.env`, then set `DATABASE_URL`.
3. Initialize tables:

Create the database from pgAdmin Query Tool while connected to `postgres`:

```sql
CREATE DATABASE aimos;
```

Then use this connection string:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aimos
```

```http
POST http://localhost:8000/api/database/init
```

4. Import saved scrape JSON files:

```http
POST http://localhost:8000/api/database/datasets/import-local
Content-Type: application/json

{
  "platform": "tiktok"
}
```

Use `"platform": "instagram"` for Instagram datasets. Add `"filename": "your_file.json"` to import one file only.
