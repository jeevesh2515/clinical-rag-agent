import httpx

from app.core.config import Settings


def web_search(settings: Settings, query: str, max_results: int = 3) -> list[dict]:
    if not settings.tavily_api_key:
        return []
    response = httpx.post(
        "https://api.tavily.com/search",
        json={"api_key": settings.tavily_api_key, "query": query, "max_results": max_results},
        timeout=20,
    )
    response.raise_for_status()
    data = response.json()
    return data.get("results", [])
