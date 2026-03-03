from __future__ import annotations

from importlib import import_module

from cliparr_core.plugins.base import StorePlugin


class PluginRegistry:
    def __init__(self) -> None:
        self._plugins: dict[str, type[StorePlugin]] = {}

    def register(self, plugin_cls: type[StorePlugin]) -> None:
        self._plugins[plugin_cls.store_key] = plugin_cls

    def get(self, store_key: str) -> type[StorePlugin] | None:
        return self._plugins.get(store_key)

    def list_keys(self) -> list[str]:
        return sorted(self._plugins.keys())

    def load_builtin_plugins(self) -> None:
        for module in ["cliparr_core.plugins.stores.hannaford"]:
            import_module(module)


registry = PluginRegistry()
