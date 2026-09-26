from __future__ import annotations

import logging
import traceback
from typing import Any

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette import status

logger = logging.getLogger(__name__)


class ApiError(Exception):
    def __init__(self, status_code: int, code: str, message: str, details: dict[str, Any] | None = None):
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}

    def to_response(self) -> dict[str, Any]:
        payload = {
            "error": {
                "code": self.code,
                "message": self.message,
                "details": self.details if self.details else None,
            }
        }
        return payload


async def api_error_handler(request: Request, exc: ApiError) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content=exc.to_response())


async def validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    payload = {
        "error": {
            "code": "invalid_request",
            "message": "Invalid request payload.",
            "details": {"errors": exc.errors()},
        }
    }
    return JSONResponse(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, content=payload)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled exception while serving %s %s", request.method, request.url.path)
    payload = {
        "error": {
            "code": "internal_error",
            "message": "An internal server error occurred.",
            "details": None,
        }
    }
    return JSONResponse(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=payload)
