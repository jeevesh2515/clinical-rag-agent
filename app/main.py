from pathlib import Path
from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.models import ApiError, ApiErrorDetail, ApiErrorResponse

configure_logging()

app = FastAPI(
    title="Clinical Evidence RAG Agent",
    version="0.1.0",
    description="Hybrid clinical RAG API with citations, tools, and evaluation.",
)

settings = get_settings()

if settings.cors_origins:
    origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID"],
    )


class MaxBodySizeMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, max_size: int = 262144):
        super().__init__(app)
        self.max_size = max_size

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > self.max_size:
            return JSONResponse(
                status_code=413,
                content={
                    "error": {
                        "code": "payload_too_large",
                        "message": f"Request body exceeds the maximum allowed size of {self.max_size} bytes.",
                        "details": [],
                        "request_id": getattr(request.state, "request_id", str(uuid4())),
                    }
                },
            )
        return await call_next(request)


app.add_middleware(MaxBodySizeMiddleware, max_size=262144)


@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    request_id = getattr(request.state, "request_id", str(uuid4()))
    error_response = ApiErrorResponse(
        error=ApiError(
            code="validation_error",
            message="Request validation failed.",
            details=[
                ApiErrorDetail(
                    field=".".join(str(location) for location in error.get("loc", [])),
                    message=str(error.get("msg", "Invalid request value.")),
                    type=str(error.get("type", "validation_error")),
                )
                for error in exc.errors()
            ],
            request_id=request_id,
        )
    )
    return JSONResponse(
        status_code=422,
        content=error_response.model_dump(),
        headers={"X-Request-ID": request_id},
    )


app.include_router(router, prefix="/api")

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIST.is_dir():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="frontend_assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_frontend(full_path: str):
        file_path = FRONTEND_DIST / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        index_path = FRONTEND_DIST / "index.html"
        if index_path.is_file():
            return FileResponse(str(index_path), media_type="text/html")
        return JSONResponse({"error": "not_found"}, status_code=404)
else:
    @app.get("/", include_in_schema=False)
    def root() -> RedirectResponse:
        return RedirectResponse(url="/docs")
