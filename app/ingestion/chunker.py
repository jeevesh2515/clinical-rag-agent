import re
from dataclasses import dataclass


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    source_id: str
    title: str
    page: int
    section: str | None
    text: str
    source_url: str
    chunk_index: int
    organization: str = ""
    publication_year: int | None = None


def normalize_text(text: str) -> str:
    text = text.replace("\x00", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def detect_heading(text: str) -> str | None:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    for line in lines[:6]:
        words = line.split()
        if 2 <= len(words) <= 12 and (line.istitle() or line.isupper() or re.match(r"^\d+(\.\d+)*\s", line)):
            return line[:140]
    return None


def _tokenish_count(text: str) -> int:
    return max(1, len(re.findall(r"\w+|[^\w\s]", text)))


def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def chunk_page(
    *,
    source_id: str,
    title: str,
    source_url: str,
    page: int,
    text: str,
    target_tokens: int = 850,
    overlap_tokens: int = 120,
    organization: str = "",
    publication_year: int | None = None,
) -> list[TextChunk]:
    text = normalize_text(text)
    if not text:
        return []

    section = detect_heading(text)
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if p.strip()]
    units: list[str] = []
    for paragraph in paragraphs:
        if _tokenish_count(paragraph) > target_tokens:
            units.extend(_split_sentences(paragraph))
        else:
            units.append(paragraph)

    chunks: list[TextChunk] = []
    current: list[str] = []
    current_tokens = 0

    def flush() -> None:
        nonlocal current, current_tokens
        if not current:
            return
        chunk_text = normalize_text("\n\n".join(current))
        if chunk_text:
            chunk_index = len(chunks) + 1
            chunks.append(
                TextChunk(
                    chunk_id=f"{source_id}:p{page}:c{chunk_index:03d}",
                    source_id=source_id,
                    title=title,
                    page=page,
                    section=section,
                    text=chunk_text,
                    source_url=source_url,
                    chunk_index=chunk_index,
                    organization=organization,
                    publication_year=publication_year,
                )
            )
        overlap: list[str] = []
        overlap_count = 0
        for unit in reversed(current):
            unit_count = _tokenish_count(unit)
            if overlap_count + unit_count > overlap_tokens and overlap:
                break
            overlap.insert(0, unit)
            overlap_count += unit_count
        current = overlap
        current_tokens = overlap_count

    for unit in units:
        unit_tokens = _tokenish_count(unit)
        if current and current_tokens + unit_tokens > target_tokens:
            flush()
        current.append(unit)
        current_tokens += unit_tokens

    flush()
    return chunks
