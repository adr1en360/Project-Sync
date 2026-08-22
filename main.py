"""The FastAPI application. This module holds the assembly and nothing else.

The design has two phases, and the split is the reason that the whole thing works
on Cloud Run.

Phase 1 is one request. It runs the graph, writes `PENDING_APPROVAL` to
Firestore, and returns. It does not hold a thread open and does not wait for a
person.

Phase 2 is a different request, and it can come minutes or days later. Cloud Run
goes to zero instances between the two, so the resume point is a row in Firestore
and the resume trigger is an HTTP request.

The status endpoint polls. A graph workflow does not support live streaming, so
the client asks again and does not hold a stream open.

The endpoints are in the `routes` package, one module for each group. This module
makes the application, adds the middleware, mounts the built interface, and
includes each router. Two routes stay here, because they belong to the
application and not to one phase: the interface at `/` and the health check at
`/healthz`.

This module also serves the interface. Vite makes a React application into
`web/dist`, and this module sends those files. One container holds the API and
the interface together, so the deploy stays at one Cloud Run service.

A machine that did not run the Vite build has no page to send, and `/` then
answers 503 with the command that makes the files.
"""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from google.auth.exceptions import DefaultCredentialsError

import config
import store
from routes import bullets, phase1, phase2, regenerate, rules, social, transactions

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def _lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Sweep stranded runs at start. Then start the application.

    Cloud Run goes to zero between requests. A run that stopped because the
    container was recycled stays at RUNNING for ever, because no code writes its
    end. Each cold start sweeps these rows to FAILED_GENERATION, so the list of
    runs does not fill with runs that cannot finish.

    A machine with no Firestore credentials must still start. So a failure of the
    sweep goes to the log, and the application starts.
    """
    try:
        swept = store.sweep_stranded_running()
        if swept:
            logger.info("The start sweep changed %d stranded run(s).", swept)
    # A machine with no credentials, or a Firestore that is down, must not stop
    # the start. The sweep is a cleanup step, and not a part of any request.
    except Exception:
        logger.warning("The start sweep did not run.", exc_info=True)
    yield


app = FastAPI(
    title="ProjectSync",
    description="Turns a finished GitHub repository into career-ready outputs.",
    version="0.1.0",
    lifespan=_lifespan,
)

# The interface comes from this same service, so a browser needs no CORS rule for
# it. The middleware goes on only if `ALLOWED_ORIGINS` names a different host.
# An open list is a real risk here, because every endpoint writes to GitHub or to
# Firestore.
if config.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )

# The React interface. Vite writes the files to `web/dist`, and the build runs
# before the deploy. The mount goes on only if the folder is present, because a
# machine that did not run the build must still start.
_WEB_DIST = Path(__file__).parent / "web" / "dist"
_WEB_ASSETS = _WEB_DIST / "assets"
if _WEB_ASSETS.is_dir():
    app.mount("/assets", StaticFiles(directory=_WEB_ASSETS), name="assets")

# Each router carries its own `/api/v1` prefix, so the order of these four lines
# changes nothing. No path in one router hides a path in another.
app.include_router(phase1.router)
app.include_router(regenerate.router)
app.include_router(phase2.router)
app.include_router(rules.router)
app.include_router(transactions.router)
app.include_router(bullets.router)
app.include_router(social.router)


@app.exception_handler(DefaultCredentialsError)
def _no_credentials(request: Request, error: DefaultCredentialsError) -> JSONResponse:
    """Change a Firestore credentials error into a reply that a person can act on.

    Every endpoint except `/` and `/healthz` reads or writes Firestore. The client
    is made at the first call, not at import, so a machine with no credentials gets
    the error here and not at start. Without this handler the reply is a bare 500
    with no text, and the most frequent cause is an empty `.env`.

    A 503 is correct: the service is good, but a resource that it needs is absent.
    """
    missing = config.missing_required()
    names = ", ".join(missing) if missing else "none"
    logger.error("Firestore has no credentials. Empty settings: %s", names)
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Firestore refused the connection because this machine has no "
                "credentials. Copy `.env.example` to `.env` and give a value to "
                f"each empty setting: {names}. For a local run also do "
                "`gcloud auth application-default login`."
            ),
            "missing_config": missing,
        },
    )


@app.get("/", include_in_schema=False)
def interface() -> FileResponse:
    """Give the interface.

    The route is explicit and not a mount at the root path. A mount at the root
    path can hide an API route, and this way the order of the routes is clear.

    Vite writes the page, and the build runs before the deploy. A machine with no
    build gets a 503 that names the command, because a stack trace about an absent
    file does not say what to do.
    """
    page = _WEB_DIST / "index.html"
    if not page.is_file():
        raise HTTPException(
            status_code=503,
            detail=(
                "The interface is not built. Run `npm ci` and `npm run build` in "
                "`web/`, then start the service again."
            ),
        )
    return FileResponse(page)


@app.get("/healthz")
def healthz() -> dict:
    """Tell if the service is up, and which settings are absent.

    The check reports the model, because the model is a pass or fail gate for the
    submission. The import of `config` fails if the model is below the floor, so a
    reply from this endpoint proves that the pin is correct.
    """
    return {
        "status": "ok",
        "model": config.MODEL,
        "use_vertex_ai": config.USE_VERTEX_AI,
        "missing_config": config.missing_required(),
    }
