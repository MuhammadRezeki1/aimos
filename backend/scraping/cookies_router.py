import json
import os
import importlib.util
from datetime import datetime
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel

from scraping.engine_tiktok.engine.tiktok_cookie_injector import (
  delete_session as delete_tiktok_session,
  get_session_info as get_tiktok_session_info,
  save_session as save_tiktok_session
)


Platform = Literal["tiktok", "instagram", "twitter", "facebook"]

router = APIRouter()

_HERE = os.path.dirname(os.path.abspath(__file__))
_SESSION_DIR = os.path.join(_HERE, "sessions")
_PLATFORM_DOMAINS = {
  "tiktok": ".tiktok.com",
  "instagram": ".instagram.com",
  "twitter": ".x.com",
  "facebook": ".facebook.com"
}
_REQUIRED_COOKIES = {
  "tiktok": {"sessionid", "sessionid_ss", "ttwid"},
  "instagram": {"sessionid", "ds_user_id", "csrftoken"},
  "twitter": {"auth_token", "ct0"},
  "facebook": {"c_user", "xs"}
}


class CookieSessionRequest(BaseModel):
  cookie_text: str
  username: str = ""
  note: str = ""


def _success(data: Any, message: str = "Success"):
  return {
    "success": True,
    "message": message,
    "timestamp": datetime.now().isoformat(),
    "data": data
  }


def _failure(message: str, data: dict | None = None):
  return {
    "success": False,
    "message": message,
    "timestamp": datetime.now().isoformat(),
    "data": data or {}
  }


def _session_file(platform: str) -> str:
  return os.path.join(_SESSION_DIR, f"{platform}_session.json")


def _parse_cookie_text(cookie_text: str, platform: str) -> list[dict]:
  raw = (cookie_text or "").strip()
  if not raw:
    raise ValueError("Cookie kosong.")

  parsed: Any
  try:
    parsed = json.loads(raw)
  except json.JSONDecodeError:
    parsed = None

  if isinstance(parsed, list):
    cookies = parsed
  elif isinstance(parsed, dict):
    cookies = parsed.get("cookies")
    if cookies is None:
      cookies = [
        {"name": key, "value": value}
        for key, value in parsed.items()
        if isinstance(value, (str, int, float, bool))
      ]
  else:
    cookies = []
    for part in raw.split(";"):
      if "=" not in part:
        continue
      name, value = part.split("=", 1)
      name = name.strip()
      if name:
        cookies.append({"name": name, "value": value.strip()})

  if not isinstance(cookies, list) or not cookies:
    raise ValueError("Format cookie tidak dikenali. Paste JSON export browser atau string name=value; name2=value2.")

  domain = _PLATFORM_DOMAINS[platform]
  normalized: list[dict] = []
  for cookie in cookies:
    if not isinstance(cookie, dict):
      continue

    name = str(cookie.get("name", "")).strip()
    value = cookie.get("value")
    if not name or value is None:
      continue

    item = dict(cookie)
    item["name"] = name
    item["value"] = str(value)
    item["domain"] = item.get("domain") or domain
    item["path"] = item.get("path") or "/"
    item["secure"] = bool(item.get("secure", True))
    normalized.append(item)

  if not normalized:
    raise ValueError("Tidak ada cookie valid yang memiliki name dan value.")

  return normalized


def _summary(platform: str, cookies: list[dict]) -> dict:
  names = {cookie.get("name") for cookie in cookies if cookie.get("name")}
  required = _REQUIRED_COOKIES[platform]
  return {
    "platform": platform,
    "valid": required.issubset(names),
    "total_cookies": len(cookies),
    "cookie_names": sorted(names),
    "missing_required": sorted(required - names)
  }


def _save_generic_session(platform: str, cookies: list[dict], username: str, note: str) -> str:
  os.makedirs(_SESSION_DIR, exist_ok=True)
  path = _session_file(platform)
  with open(path, "w", encoding="utf-8") as file:
    json.dump(
      {
        "platform": platform,
        "username": username,
        "note": note,
        "saved_at": datetime.now().isoformat(),
        "cookies": cookies
      },
      file,
      ensure_ascii=False,
      indent=2
    )
  return path


def _read_generic_session(platform: str) -> dict:
  path = _session_file(platform)
  if not os.path.exists(path):
    return {
      "platform": platform,
      "valid": False,
      "error": "Session belum ada."
    }

  with open(path, "r", encoding="utf-8") as file:
    data = json.load(file)

  return _summary(platform, data.get("cookies", []))


def _delete_generic_session(platform: str) -> bool:
  path = _session_file(platform)
  if os.path.exists(path):
    os.remove(path)
    return True
  return False


def _instagram_session_manager():
  module_path = os.path.join(
    _HERE,
    "engine_instagram",
    "engine",
    "session_manager.py"
  )
  spec = importlib.util.spec_from_file_location("aimos_instagram_session_manager", module_path)
  if spec is None or spec.loader is None:
    raise RuntimeError("Instagram session manager tidak ditemukan.")
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  return module


def _save_instagram_engine_session(cookies: list[dict]) -> None:
  manager = _instagram_session_manager()
  manager.save_session(cookies)


def _delete_instagram_engine_session() -> bool:
  try:
    manager = _instagram_session_manager()
    return bool(manager.clear_session())
  except Exception:
    return False


@router.get("/{platform}")
def get_cookie_session(platform: Platform):
  if platform == "tiktok":
    info = get_tiktok_session_info()
    info["platform"] = "tiktok"
    return _success(info, "TikTok cookie session status")

  return _success(_read_generic_session(platform), f"{platform.title()} cookie session status")


@router.post("/{platform}")
def save_cookie_session(platform: Platform, req: CookieSessionRequest):
  try:
    cookies = _parse_cookie_text(req.cookie_text, platform)
  except ValueError as error:
    return _failure(str(error))

  if platform == "tiktok":
    save_tiktok_session(cookies, username=req.username, note=req.note)
    info = get_tiktok_session_info()
    info["platform"] = "tiktok"
    if not info.get("valid"):
      return _failure("Cookie TikTok tersimpan, tapi cookie wajib belum lengkap.", info)
    return _success(info, "Cookie TikTok tersimpan dan session valid.")

  _save_generic_session(platform, cookies, req.username, req.note)
  info = _summary(platform, cookies)
  if not info["valid"]:
    return _failure(f"Cookie {platform.title()} tersimpan, tapi cookie wajib belum lengkap.", info)
  if platform == "instagram":
    try:
      _save_instagram_engine_session(cookies)
    except Exception as error:
      return _failure(f"Cookie Instagram tersimpan, tapi gagal menyinkronkan session engine: {error}", info)
  return _success(info, f"Cookie {platform.title()} tersimpan.")


@router.delete("/{platform}")
def delete_cookie_session(platform: Platform):
  if platform == "tiktok":
    deleted = delete_tiktok_session()
    info = get_tiktok_session_info()
    info["platform"] = "tiktok"
    return _success(
      info,
      "Cookie TikTok session dihapus." if deleted else "Cookie TikTok session belum ada."
    )

  deleted = _delete_generic_session(platform)
  if platform == "instagram":
    deleted = _delete_instagram_engine_session() or deleted
  info = _read_generic_session(platform)
  return _success(
    info,
    f"Cookie {platform.title()} session dihapus." if deleted else f"Cookie {platform.title()} session belum ada."
  )
