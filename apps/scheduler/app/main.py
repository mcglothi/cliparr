import json
import os
import time
from datetime import datetime

import redis
from apscheduler.schedulers.blocking import BlockingScheduler

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = "cliparr:jobs"
CRON_EXPR = os.getenv("CLIPARR_DAILY_RUN_CRON", "0 6 * * *")


def enqueue_daily_jobs() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    # MVP: hardcoded account map; API-driven account discovery is next milestone.
    jobs = [
        {"store_key": "hannaford", "credentials": {"username": "", "password": ""}},
    ]
    for job in jobs:
        client.rpush(QUEUE_KEY, json.dumps(job))
    print(f"[{datetime.utcnow().isoformat()}] enqueued {len(jobs)} jobs")


def main() -> None:
    scheduler = BlockingScheduler(timezone=os.getenv("CLIPARR_TIMEZONE", "America/New_York"))
    minute, hour, day, month, dow = CRON_EXPR.split()
    scheduler.add_job(
        enqueue_daily_jobs,
        "cron",
        minute=minute,
        hour=hour,
        day=day,
        month=month,
        day_of_week=dow,
        id="daily_coupon_run",
        replace_existing=True,
    )

    enqueue_daily_jobs()
    scheduler.start()


if __name__ == "__main__":
    while True:
        try:
            main()
        except Exception:
            time.sleep(5)
