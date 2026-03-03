from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class ClipResult:
    store: str
    clipped_count: int
    status: str
    message: str = ""


class StorePlugin(ABC):
    store_key: str
    store_name: str

    @abstractmethod
    async def login(self, page, credentials: dict) -> None:
        raise NotImplementedError

    @abstractmethod
    async def navigate_to_coupons(self, page) -> None:
        raise NotImplementedError

    @abstractmethod
    async def clip_all(self, page) -> int:
        raise NotImplementedError

    async def run(self, page, credentials: dict) -> ClipResult:
        await self.login(page, credentials)
        await self.navigate_to_coupons(page)
        clipped = await self.clip_all(page)
        return ClipResult(
            store=self.store_key,
            clipped_count=clipped,
            status="success",
            message=f"Clipped {clipped} coupons",
        )
