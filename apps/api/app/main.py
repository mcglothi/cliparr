import json
from datetime import datetime
from zoneinfo import ZoneInfo

import redis
from croniter import croniter
from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from cliparr_core.plugins.registry import registry
from cliparr_core.security.crypto import decrypt_secret, encrypt_secret

from .config import settings
from .db import get_session, init_db
from .models import JobRun, Schedule, StoreAccount

app = FastAPI(title="Cliparr API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.cliparr_web_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["*"],
)


def redis_client() -> redis.Redis:
    return redis.from_url(settings.redis_url, decode_responses=True)


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


class StoreAccountPatch(BaseModel):
    account_label: str | None = None
    username: str | None = None
    password: str | None = None
    enabled: bool | None = None


class StoreAccountOut(BaseModel):
    id: int
    store_key: str
    account_label: str
    username: str
    enabled: bool


@app.get("/accounts", response_model=list[StoreAccountOut])
def list_accounts(session: Session = Depends(get_session)) -> list[StoreAccount]:
    return list(session.exec(select(StoreAccount).order_by(StoreAccount.created_at.desc())))


@app.post("/accounts", response_model=StoreAccountOut)
def create_account(payload: StoreAccountCreate, session: Session = Depends(get_session)) -> StoreAccount:
    if payload.store_key not in registry.list_keys():
        raise HTTPException(status_code=400, detail="Unknown store key")

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


@app.patch("/accounts/{account_id}", response_model=StoreAccountOut)
def patch_account(account_id: int, payload: StoreAccountPatch, session: Session = Depends(get_session)) -> StoreAccount:
    account = session.get(StoreAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    if payload.account_label is not None:
        account.account_label = payload.account_label
    if payload.username is not None:
        account.username = payload.username
    if payload.enabled is not None:
        account.enabled = payload.enabled
    if payload.password:
        account.encrypted_password = encrypt_secret(settings.cliparr_encryption_key, payload.password)

    session.add(account)
    session.commit()
    session.refresh(account)
    return account


@app.delete("/accounts/{account_id}")
def delete_account(account_id: int, session: Session = Depends(get_session)) -> dict[str, str]:
    account = session.get(StoreAccount, account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    schedules = list(session.exec(select(Schedule).where(Schedule.account_id == account_id)))
    for schedule in schedules:
        session.delete(schedule)

    session.delete(account)
    session.commit()
    return {"status": "deleted"}


class ScheduleCreate(BaseModel):
    account_id: int
    cron: str = Field(min_length=9)
    timezone: str = "America/New_York"
    enabled: bool = True


class SchedulePatch(BaseModel):
    cron: str | None = None
    timezone: str | None = None
    enabled: bool | None = None


class ScheduleOut(BaseModel):
    id: int
    account_id: int
    account_label: str
    store_key: str
    cron: str
    timezone: str
    enabled: bool
    last_enqueued_at: datetime | None


def validate_schedule_fields(cron: str, timezone: str) -> None:
    if not croniter.is_valid(cron):
        raise HTTPException(status_code=400, detail="Invalid cron expression")
    try:
        ZoneInfo(timezone)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid timezone") from exc


@app.get("/schedules", response_model=list[ScheduleOut])
def list_schedules(session: Session = Depends(get_session)) -> list[ScheduleOut]:
    schedules = list(session.exec(select(Schedule).order_by(Schedule.created_at.desc())))
    accounts = {a.id: a for a in session.exec(select(StoreAccount))}
    output: list[ScheduleOut] = []
    for schedule in schedules:
        account = accounts.get(schedule.account_id)
        if not account:
            continue
        output.append(
            ScheduleOut(
                id=schedule.id,
                account_id=schedule.account_id,
                account_label=account.account_label,
                store_key=account.store_key,
                cron=schedule.cron,
                timezone=schedule.timezone,
                enabled=schedule.enabled,
                last_enqueued_at=schedule.last_enqueued_at,
            )
        )
    return output


@app.post("/schedules", response_model=ScheduleOut)
def create_schedule(payload: ScheduleCreate, session: Session = Depends(get_session)) -> ScheduleOut:
    validate_schedule_fields(payload.cron, payload.timezone)
    account = session.get(StoreAccount, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    schedule = Schedule(
        account_id=payload.account_id,
        cron=payload.cron,
        timezone=payload.timezone,
        enabled=payload.enabled,
    )
    session.add(schedule)
    session.commit()
    session.refresh(schedule)

    return ScheduleOut(
        id=schedule.id,
        account_id=schedule.account_id,
        account_label=account.account_label,
        store_key=account.store_key,
        cron=schedule.cron,
        timezone=schedule.timezone,
        enabled=schedule.enabled,
        last_enqueued_at=schedule.last_enqueued_at,
    )


@app.patch("/schedules/{schedule_id}", response_model=ScheduleOut)
def patch_schedule(schedule_id: int, payload: SchedulePatch, session: Session = Depends(get_session)) -> ScheduleOut:
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    account = session.get(StoreAccount, schedule.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    new_cron = payload.cron if payload.cron is not None else schedule.cron
    new_tz = payload.timezone if payload.timezone is not None else schedule.timezone
    validate_schedule_fields(new_cron, new_tz)

    schedule.cron = new_cron
    schedule.timezone = new_tz
    if payload.enabled is not None:
        schedule.enabled = payload.enabled

    session.add(schedule)
    session.commit()
    session.refresh(schedule)

    return ScheduleOut(
        id=schedule.id,
        account_id=schedule.account_id,
        account_label=account.account_label,
        store_key=account.store_key,
        cron=schedule.cron,
        timezone=schedule.timezone,
        enabled=schedule.enabled,
        last_enqueued_at=schedule.last_enqueued_at,
    )


@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, session: Session = Depends(get_session)) -> dict[str, str]:
    schedule = session.get(Schedule, schedule_id)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    session.delete(schedule)
    session.commit()
    return {"status": "deleted"}


class RunTrigger(BaseModel):
    account_id: int


@app.post("/runs/trigger")
def trigger_run(payload: RunTrigger, session: Session = Depends(get_session)) -> dict[str, str]:
    account = session.get(StoreAccount, payload.account_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    if not account.enabled:
        raise HTTPException(status_code=400, detail="Account is disabled")

    queue = redis_client()
    queue.rpush(
        "cliparr:jobs",
        json.dumps(
            {
            "account_id": account.id,
            "store_key": account.store_key,
            "credentials": {
                "username": account.username,
                "password": decrypt_secret(settings.cliparr_encryption_key, account.encrypted_password),
            },
            }
        ),
    )
    return {"status": "queued"}


@app.get("/runs")
def list_runs(session: Session = Depends(get_session)) -> list[JobRun]:
    return list(session.exec(select(JobRun).order_by(JobRun.started_at.desc()).limit(100)))


@app.get("/insights")
def insights(session: Session = Depends(get_session)) -> dict[str, float | int]:
    runs = list(session.exec(select(JobRun)))
    success = [r for r in runs if r.status == "success"]
    total_clipped = sum(r.clipped_count for r in runs)
    success_rate = (len(success) / len(runs) * 100) if runs else 0

    account_count = len(list(session.exec(select(StoreAccount))))
    schedule_count = len(list(session.exec(select(Schedule).where(Schedule.enabled == True))))  # noqa: E712

    return {
        "total_runs": len(runs),
        "successful_runs": len(success),
        "success_rate": round(success_rate, 1),
        "total_clipped": total_clipped,
        "accounts": account_count,
        "enabled_schedules": schedule_count,
    }


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


@app.get("/internal/scheduler/due-jobs")
def due_jobs(session: Session = Depends(get_session)) -> dict[str, list[dict]]:
    jobs: list[dict] = []
    now_utc = datetime.utcnow()
    minute_mark = now_utc.replace(second=0, microsecond=0)

    schedules = list(session.exec(select(Schedule).where(Schedule.enabled == True)))  # noqa: E712
    for schedule in schedules:
        account = session.get(StoreAccount, schedule.account_id)
        if not account or not account.enabled:
            continue

        local_now = now_utc.astimezone(ZoneInfo(schedule.timezone))
        local_minute = local_now.replace(second=0, microsecond=0)

        if not croniter.match(schedule.cron, local_minute):
            continue

        if schedule.last_enqueued_at and schedule.last_enqueued_at >= minute_mark:
            continue

        schedule.last_enqueued_at = minute_mark
        session.add(schedule)

        jobs.append(
            {
                "schedule_id": schedule.id,
                "account_id": account.id,
                "store_key": account.store_key,
                "credentials": {
                    "username": account.username,
                    "password": decrypt_secret(settings.cliparr_encryption_key, account.encrypted_password),
                },
            }
        )

    session.commit()
    return {"jobs": jobs}
