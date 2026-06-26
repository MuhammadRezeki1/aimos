from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
  return {
    "engine": "twitter",
    "status": "placeholder",
    "message": "Twitter/X scraping engine is not implemented yet."
  }
