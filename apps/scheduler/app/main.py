import json
import os
import time
from datetime import datetime

import httpx
import redis
from apscheduler.schedulers.blocking import BlockingScheduler

API_BASE = os.getenv("CLIPARR_API_URL", "http://api:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = "cliparr:jobs"


def enqueue_due_jobs() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    with httpx.Client(timeout=20) as http:
        response = http.get(f"{API_BASE}/internal/scheduler/due-jobs")
        response.raise_for_status()
        jobs = response.json().get("jobs", [])

    for job in jobs:
        client.rpush(QUEUE_KEY, json.dumps(job))

    print(f"[{datetime.utcnow().isoformat()}] enqueued {len(jobs)} scheduled jobs")


def main() -> None:
    scheduler = BlockingScheduler(timezone=os.getenv("CLIPARR_TIMEZONE", "America/New_York"))
    scheduler.add_job(
        enqueue_due_jobs,
        "cron",
        second="5",
        id="per_minute_schedule_scan",
        replace_existing=True,
    )

    enqueue_due_jobs()
    scheduler.start()


if __name__ == "__main__":
    while True:
        try:
            main()
        except Exception as exc:
            print(f"scheduler error: {exc}")
            time.sleep(5)
