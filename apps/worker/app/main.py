import asyncio
import json
import os
from pathlib import Path
from datetime import datetime

import httpx
import redis
from cliparr_core.plugins.registry import registry
from playwright.async_api import async_playwright

API_BASE = os.getenv("CLIPARR_API_URL", "http://api:8000")
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUE_KEY = "cliparr:jobs"
ARTIFACT_DIR = Path(os.getenv("CLIPARR_ARTIFACT_DIR", "/tmp/cliparr-artifacts"))


async def capture_debug_artifacts(page, store_key: str) -> str:
    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.utcnow().strftime("%Y%m%dT%H%M%S")
    slug = f"{store_key}-{stamp}"
    png_path = ARTIFACT_DIR / f"{slug}.png"
    html_path = ARTIFACT_DIR / f"{slug}.html"
    meta_path = ARTIFACT_DIR / f"{slug}.json"

    title = ""
    url = ""
    buttons: list[str] = []

    try:
        title = await page.title()
        url = page.url
        buttons = await page.locator("button").all_text_contents()
    except Exception:
        pass

    try:
        await page.screenshot(path=str(png_path), full_page=True)
    except Exception:
        pass

    try:
        html = await page.content()
        html_path.write_text(html)
    except Exception:
        pass

    try:
        meta = {
            "store": store_key,
            "captured_at_utc": datetime.utcnow().isoformat(),
            "title": title,
            "url": url,
            "button_texts_sample": [b.strip().replace("\n", " ") for b in buttons if b.strip()][:100],
            "png": str(png_path),
            "html": str(html_path),
        }
        meta_path.write_text(json.dumps(meta, indent=2))
    except Exception:
        pass

    return str(meta_path)


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
            artifact_path = await capture_debug_artifacts(page, store_key)
            return {
                "status": "error",
                "store_key": store_key,
                "clipped_count": 0,
                "message": f"{type(exc).__name__}: {exc} | debug: {artifact_path}",
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
