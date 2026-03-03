import asyncio
import json
import os
from datetime import datetime

import httpx
import redis
from cliparr_core.plugins.registry import registry
from playwright.async_api import async_playwright

API_BASE = os.getenv("CLIPARR_API_URL", "http://api:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = "cliparr:jobs"


async def run_store_job(store_key: str, credentials: dict) -> dict:
    registry.load_builtin_plugins()
    plugin_cls = registry.get(store_key)
    if not plugin_cls:
        return {"status": "error", "message": f"Unknown store: {store_key}"}

    plugin = plugin_cls()
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        try:
            result = await plugin.run(page, credentials)
            return {
                "status": result.status,
                "store_key": store_key,
                "clipped_count": result.clipped_count,
                "message": result.message,
            }
        except Exception as exc:
            return {
                "status": "error",
                "store_key": store_key,
                "clipped_count": 0,
                "message": f"{type(exc).__name__}: {exc}",
            }
        finally:
            await browser.close()


async def loop() -> None:
    client = redis.from_url(REDIS_URL, decode_responses=True)
    while True:
        job = client.blpop(QUEUE_KEY, timeout=5)
        if not job:
            await asyncio.sleep(1)
            continue

        payload = json.loads(job[1])
        result = await run_store_job(payload["store_key"], payload.get("credentials", {}))
        result["finished_at"] = datetime.utcnow().isoformat()
        try:
            async with httpx.AsyncClient(timeout=10) as http:
                await http.post(f"{API_BASE}/internal/runs", json=result)
        except Exception:
            # Scheduler and API keep a durable queue/history; worker should stay alive.
            pass


if __name__ == "__main__":
    asyncio.run(loop())
