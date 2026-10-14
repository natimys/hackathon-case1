from dataclasses import dataclass

import httpx


@dataclass(frozen=True)
class MediaStatus:
    status: str


class MediaProvider:
    """Encapsulates all calls to MediaMTX control and media endpoints."""

    def __init__(
        self,
        api_url: str,
        hls_url: str,
        transport: httpx.AsyncBaseTransport | None = None,
    ):
        self.api_url = api_url.rstrip("/")
        self.hls_base_url = hls_url.rstrip("/")
        self.transport = transport

    async def status(self, stream_path: str) -> MediaStatus:
        try:
            async with httpx.AsyncClient(
                timeout=2.5, transport=self.transport
            ) as client:
                response = await client.get(f"{self.api_url}/v3/paths/list")
                response.raise_for_status()
                items = response.json().get("items", [])
                item = next(
                    (row for row in items if row.get("name") == stream_path), None
                )
                return MediaStatus(
                    "online" if item and item.get("ready") else "offline"
                )
        except (httpx.HTTPError, ValueError, TypeError):
            return MediaStatus("unknown")

    def hls_url(self, stream_path: str) -> str:
        return f"{self.hls_base_url}/{stream_path}/index.m3u8"


def get_media_provider():
    from core.settings import get_settings

    settings = get_settings()
    return MediaProvider(settings.MEDIAMTX_API_URL, settings.MEDIAMTX_HLS_URL)
