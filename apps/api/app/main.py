from datetime import datetime

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from cliparr_core.plugins.registry import registry
from cliparr_core.security.crypto import encrypt_secret

from .config import settings
from .db import get_session, init_db
from .models import JobRun, StoreAccount

app = FastAPI(title="Cliparr API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cliparr_web_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup() -> None:
    init_db()
    registry.load_builtin_plugins()


@app.get("/healthz")
def healthz() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/stores")
def list_stores() -> dict[str, list[str]]:
    return {"stores": registry.list_keys()}


class StoreAccountCreate(BaseModel):
    store_key: str
    account_label: str
    username: str
    password: str = Field(min_length=1)


class StoreAccountOut(BaseModel):
    id: int
    store_key: str
    account_label: str
    username: str
    enabled: bool


@app.get("/accounts", response_model=list[StoreAccountOut])
def list_accounts(session: Session = Depends(get_session)) -> list[StoreAccount]:
    return list(session.exec(select(StoreAccount)))


@app.post("/accounts", response_model=StoreAccountOut)
def create_account(payload: StoreAccountCreate, session: Session = Depends(get_session)) -> StoreAccount:
    encrypted = encrypt_secret(settings.cliparr_encryption_key, payload.password)
    account = StoreAccount(
        store_key=payload.store_key,
        account_label=payload.account_label,
        username=payload.username,
        encrypted_password=encrypted,
    )
    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@app.get("/runs")
def list_runs(session: Session = Depends(get_session)) -> list[JobRun]:
    return list(session.exec(select(JobRun).order_by(JobRun.started_at.desc()).limit(50)))


class RunIngest(BaseModel):
    store_key: str
    status: str
    clipped_count: int = 0
    message: str = ""


@app.post("/internal/runs")
def ingest_run(payload: RunIngest, session: Session = Depends(get_session)) -> dict[str, str]:
    run = JobRun(
        store_key=payload.store_key,
        status=payload.status,
        clipped_count=payload.clipped_count,
        message=payload.message,
        finished_at=datetime.utcnow(),
    )
    session.add(run)
    session.commit()
    return {"status": "accepted"}
