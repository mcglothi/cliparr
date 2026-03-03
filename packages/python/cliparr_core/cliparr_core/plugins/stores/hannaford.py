from __future__ import annotations

from cliparr_core.plugins.base import StorePlugin
from cliparr_core.plugins.registry import registry


class HannafordPlugin(StorePlugin):
    store_key = "hannaford"
    store_name = "Hannaford"

    async def login(self, page, credentials: dict) -> None:
        await page.goto("https://www.hannaford.com/coupons", wait_until="domcontentloaded")

        sign_in_link = page.get_by_role("link", name="sign in")
        if await sign_in_link.count() > 0:
            await sign_in_link.first.click()
            await page.wait_for_selector("div#loginCred", timeout=15000)
            await page.fill("#userNameLogin", credentials["username"])
            await page.fill("#passwordLogin", credentials["password"])
            await page.click("div#loginCred button.btn-primary")
            await page.wait_for_timeout(3000)

    async def navigate_to_coupons(self, page) -> None:
        await page.goto("https://www.hannaford.com/coupons", wait_until="networkidle")
        ok_button = page.get_by_role("button", name="Ok, got it!")
        if await ok_button.count() > 0:
            await ok_button.first.click()

        focus_close = page.locator("#fsrFocusFirst")
        if await focus_close.count() > 0:
            await focus_close.first.click()

    async def clip_all(self, page) -> int:
        previous_count = -1
        while True:
            targets = page.locator(".clipTarget")
            current_count = await targets.count()
            if current_count == previous_count:
                break
            previous_count = current_count
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1200)

        targets = page.locator(".clipTarget")
        count = await targets.count()
        for idx in range(count):
            try:
                await targets.nth(idx).click(timeout=4000)
                await page.wait_for_timeout(250)
            except Exception:
                continue
        return count


registry.register(HannafordPlugin)
