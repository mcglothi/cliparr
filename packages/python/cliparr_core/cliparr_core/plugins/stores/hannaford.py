from __future__ import annotations

from cliparr_core.plugins.base import StorePlugin
from cliparr_core.plugins.registry import registry


class HannafordPlugin(StorePlugin):
    store_key = "hannaford"
    store_name = "Hannaford"

    async def login(self, page, credentials: dict) -> None:
        await page.goto("https://www.hannaford.com/", wait_until="domcontentloaded")
        await page.click("button:has-text('Sign In')")
        await page.fill("input[type='email']", credentials["username"])
        await page.fill("input[type='password']", credentials["password"])
        await page.click("button[type='submit']")

    async def navigate_to_coupons(self, page) -> None:
        await page.goto("https://www.hannaford.com/coupons", wait_until="networkidle")

    async def clip_all(self, page) -> int:
        buttons = page.locator("button:has-text('Clip')")
        count = await buttons.count()
        for idx in range(count):
            await buttons.nth(idx).click()
        return count


registry.register(HannafordPlugin)
