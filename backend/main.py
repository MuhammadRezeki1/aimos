import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

from scraping.cookies_router import router as cookies_router
from database.router import router as database_router
from scraping.engine_facebook.router import router as facebook_router
from scraping.engine_instagram.router import router as instagram_router
from scraping.engine_tiktok.router import router as tiktok_router
from scraping.engine_twitter.router import router as twitter_router


load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))


def _cors_origins() -> list[str]:
  raw = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
  if raw.strip() == "*":
    return ["*"]
  return [origin.strip() for origin in raw.split(",") if origin.strip()]


app = FastAPI(
  title="AIMOS Scraping Backend",
  description="FastAPI backend for AIMOS social media scraping engines.",
  version="0.1.0"
)

app.add_middleware(
  CORSMiddleware,
  allow_origins=_cors_origins(),
  allow_credentials=True,
  allow_methods=["*"],
  allow_headers=["*"]
)

app.include_router(tiktok_router, prefix="/api/tiktok", tags=["TikTok"])
app.include_router(instagram_router, prefix="/api/instagram", tags=["Instagram"])
app.include_router(twitter_router, prefix="/api/twitter", tags=["Twitter"])
app.include_router(facebook_router, prefix="/api/facebook", tags=["Facebook"])
app.include_router(cookies_router, prefix="/api/cookies", tags=["Cookie Sessions"])
app.include_router(database_router, prefix="/api/database", tags=["Database"])


@app.get("/")
def root():
  return {
    "service": "AIMOS Scraping Backend",
    "status": "ok",
    "docs": "/docs"
  }


@app.get("/api/health")
def health():
  return {
    "status": "ok",
    "engines": {
      "tiktok": "ready",
      "instagram": "ready",
      "twitter": "placeholder",
      "facebook": "placeholder"
    }
  }
