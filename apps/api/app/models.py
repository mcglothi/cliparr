from datetime import datetime

from sqlmodel import Field, SQLModel


class StoreAccount(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    store_key: str = Field(index=True)
    account_label: str
    username: str
    encrypted_password: str
    enabled: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)


class Schedule(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(index=True)
    cron: str
    timezone: str = "America/New_York"
    enabled: bool = True
    last_enqueued_at: datetime | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class JobRun(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    store_key: str = Field(index=True)
    status: str
    clipped_count: int = 0
    message: str = ""
    started_at: datetime = Field(default_factory=datetime.utcnow)
    finished_at: datetime | None = None
