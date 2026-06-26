from __future__ import annotations

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from .normalizer import iter_dataset_files
from .postgres import import_dataset_file, init_schema


Platform = Literal["tiktok", "instagram"]

router = APIRouter()


class ImportDatasetsRequest(BaseModel):
    platform: Platform
    filename: str | None = None


def _ok(data, message: str = "Success"):
    return {"success": True, "message": message, "data": data}


def _fail(message: str):
    return {"success": False, "message": message, "data": {}}


@router.post("/init")
def init_database():
    try:
        init_schema()
        return _ok({"initialized": True}, "Schema PostgreSQL siap")
    except Exception as error:
        return _fail(str(error))


@router.post("/datasets/import-local")
def import_local_datasets(req: ImportDatasetsRequest):
    try:
        files = list(iter_dataset_files(req.platform, req.filename))
        if not files:
            return _ok({"imported": [], "total_files": 0}, "Tidak ada dataset JSON")

        imported = [import_dataset_file(req.platform, path) for path in files]
        return _ok(
            {"imported": imported, "total_files": len(imported)},
            f"{len(imported)} dataset berhasil di-import",
        )
    except Exception as error:
        return _fail(str(error))

