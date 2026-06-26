from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health():
  return {
    "engine": "facebook",
    "status": "placeholder",
    "message": "Facebook scraping engine is not implemented yet."
  }
