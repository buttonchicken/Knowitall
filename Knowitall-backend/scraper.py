from urllib.parse import urlparse, urlunparse
from crawl4ai import AsyncWebCrawler, CrawlerRunConfig, CacheMode

APP_SUBDOMAINS = {"work", "app", "dashboard", "portal", "login", "signin", "auth", "admin"}


def get_text(result) -> str:
    if not result.success or not result.markdown:
        return ""
    return (result.markdown.fit_markdown or result.markdown.raw_markdown or "").strip()


def root_domain(hostname: str) -> str:
    parts = hostname.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else hostname


def is_app_subdomain(hostname: str) -> bool:
    parts = hostname.split(".")
    return len(parts) > 2 and parts[0] in APP_SUBDOMAINS


def canonical(url: str) -> str:
    p = urlparse(url)
    return urlunparse((p.scheme, p.netloc, p.path.rstrip("/") or "/", "", "", ""))


def marketing_homepage(url: str) -> str:
    parsed = urlparse(url)
    if is_app_subdomain(parsed.hostname or ""):
        parts = (parsed.hostname or "").split(".")
        root_host = ".".join(parts[1:])
        return f"{parsed.scheme}://{root_host}/"
    return url.split("?")[0].split("#")[0].rstrip("/") + "/"


def extract_nav_footer_links(result, base_hostname: str) -> list[str]:
    if not result.success:
        return []

    links_data = (result.links or {}).get("internal", [])
    seen: set[str] = set()
    out: list[str] = []

    for item in links_data:
        href = (item.get("href") or "").split("#")[0].strip()
        if not href:
            continue

        parsed = urlparse(href)
        host = parsed.hostname or ""

        if root_domain(host) != root_domain(base_hostname):
            continue
        if is_app_subdomain(host):
            continue
        if parsed.query:
            continue

        depth = len([s for s in parsed.path.strip("/").split("/") if s])
        if depth > 3:
            continue

        c = canonical(href)
        if c in seen:
            continue
        seen.add(c)
        out.append(href)

    return out


async def crawl_one(crawler: AsyncWebCrawler, url: str):
    config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        remove_overlay_elements=True,
        exclude_external_links=True,
    )
    return await crawler.arun(url=url, config=config)


def build_combined(results: list, cap: int = 80_000) -> str:
    chunks: list[str] = []
    total = 0
    for r in results:
        text = get_text(r)
        if not text:
            continue
        header = f"\n\n--- SOURCE: {r.url} ---\n\n"
        available = cap - total - len(header)
        if available <= 0:
            break
        chunks.append(header + text[:available])
        total += len(header) + min(len(text), available)
    return "".join(chunks)


async def scrape_company_website(url: str) -> str:
    import asyncio

    start_url = marketing_homepage(url)
    parsed_start = urlparse(start_url)
    base_hostname = parsed_start.hostname or ""

    async with AsyncWebCrawler() as crawler:
        homepage = await crawl_one(crawler, start_url)
        page_links = extract_nav_footer_links(homepage, base_hostname)

        homepage_canonical = canonical(start_url)
        to_crawl = [u for u in page_links if canonical(u) != homepage_canonical][:25]

        subpage_results = await asyncio.gather(
            *[crawl_one(crawler, u) for u in to_crawl],
            return_exceptions=True,
        )

    all_results = []
    if get_text(homepage):
        all_results.append(homepage)
    for r in subpage_results:
        if not isinstance(r, Exception) and get_text(r):
            all_results.append(r)

    if not all_results:
        raise Exception(f"No content could be scraped from {url} (resolved to {start_url})")

    return build_combined(all_results)
