import logging
import re
from pathlib import Path

import yaml

from app.okf.models import OKFDocument
from app.okf.normalize import normalize_query

logger = logging.getLogger(__name__)

WIKILINK_PATTERN = re.compile(r"\[\[([\w/\-]+)(?:#([\w\-]+))?\]\]")


class OKFRetriever:
    """Deterministic retriever over the OKF markdown bundle.

    Loads INDEX.md as the concept map. Retrieval is exact path/tag based —
    no embeddings, no vector search.
    """

    def __init__(self, okf_root: str | Path) -> None:
        self._root = Path(okf_root)
        self._index_path = self._root / "INDEX.md"
        self._index_map: dict[str, str] = {}
        self._tag_index: dict[str, list[str]] = {}
        self._content_cache: dict[str, OKFDocument] = {}
        self._load_index()

    def _load_index(self) -> None:
        if not self._index_path.exists():
            logger.warning("OKF INDEX.md not found at %s", self._index_path)
            return
        text = self._index_path.read_text(encoding="utf-8")
        for line in text.splitlines():
            table_match = re.match(r"^\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|", line)
            if table_match:
                title = table_match.group(1).strip()
                rel_path = table_match.group(2).strip()
                self._index_map[title] = rel_path
        logger.info(
            "OKF index loaded: %d concepts",
            len(self._index_map),
        )

    def get_concept_map(self) -> dict[str, str]:
        """Return the INDEX.md as {title: relative_path}."""
        return dict(self._index_map)

    def get_concept(self, path: str) -> OKFDocument | None:
        """Return a single concept file by its relative path.

        Path should be relative to okf_root (e.g. 'diagnosis/bp-categories').
        The .md extension is added automatically.
        """
        cache_key = path
        if cache_key in self._content_cache:
            return self._content_cache[cache_key]

        file_path = self._resolve_path(path)
        if not file_path or not file_path.exists():
            return None

        return self._parse_and_cache(cache_key, file_path)

    def get_section(self, tag: str) -> list[OKFDocument]:
        """Return all files matching a given tag."""
        tag_lower = tag.lower()
        matching: list[str] = []
        for concept_path in self._index_map.values():
            doc = self.get_concept(concept_path.replace(".md", "").lstrip("/"))
            if doc and tag_lower in [t.lower() for t in doc.tags]:
                matching.append(concept_path.replace(".md", "").lstrip("/"))
        return [
            self.get_concept(path) for path in matching if self.get_concept(path) is not None
        ]

    def resolve_links(self, content: str, max_hops: int = 2) -> str:
        """Follow [[wikilinks]] and inline referenced concepts.

        Does a breadth-first traversal up to `max_hops` deep.
        Each referenced concept is appended as a blockquote.
        """
        seen: set[str] = set()
        result = content
        current = content
        for hop in range(max_hops):
            links = WIKILINK_PATTERN.findall(current)
            if not links:
                break
            for link_target, _anchor in links:
                if link_target in seen:
                    continue
                seen.add(link_target)
                linked = self.get_concept(link_target)
                if linked:
                    result += f"\n\n> **Referenced: {linked.title}**\n> {linked.content[:500]}"
            current = result
        return result

    def retrieve(self, query_intent: str) -> list[OKFDocument]:
        """Main retrieval interface: find OKF concepts matching the query intent.

        Uses tag-based matching against the concept map as a progressive
        disclosure mechanism. Falls back to searching titles.
        """
        query_lower = normalize_query(query_intent)

        tag_matches = self._find_by_tag(query_lower)
        if tag_matches:
            return tag_matches

        title_matches = self._find_by_title(query_lower)
        if title_matches:
            return title_matches

        return []

    def _find_by_tag(self, query: str) -> list[OKFDocument]:
        known_tags: dict[str, list[str]] = {}
        for concept_path in self._index_map.values():
            doc = self.get_concept(concept_path.replace(".md", "").lstrip("/"))
            if doc:
                for tag in doc.tags:
                    tag_lower = tag.lower()
                    if tag_lower not in known_tags:
                        known_tags[tag_lower] = []
                    known_tags[tag_lower].append(concept_path.replace(".md", "").lstrip("/"))

        for tag_value, paths in known_tags.items():
            if tag_value in query:
                return [
                    doc
                    for p in paths
                    if (doc := self.get_concept(p)) is not None
                ]
        return []

    def _find_by_title(self, query: str) -> list[OKFDocument]:
        query_words = set(query.split())
        scored: list[tuple[int, OKFDocument]] = []
        for concept_path in self._index_map.values():
            doc = self.get_concept(concept_path.replace(".md", "").lstrip("/"))
            if doc:
                title_words = set(doc.title.lower().split())
                overlap = len(query_words & title_words)
                if overlap > 0:
                    scored.append((overlap, doc))
        scored.sort(key=lambda x: x[0], reverse=True)
        return [doc for _, doc in scored]

    def _resolve_path(self, path: str) -> Path | None:
        stem = path.replace(".md", "")
        candidates = [
            self._root / f"{stem}.md",
            self._root / stem / "INDEX.md",
        ]
        for candidate in candidates:
            if candidate.exists():
                return candidate
        return None

    def _parse_and_cache(self, cache_key: str, file_path: Path) -> OKFDocument:
        raw = file_path.read_text(encoding="utf-8")
        frontmatter, body = self._split_frontmatter(raw)

        doc = OKFDocument(
            source_path=str(file_path.relative_to(self._root)),
            title=frontmatter.get("title", file_path.stem),
            content=body.strip(),
            tags=frontmatter.get("tags", []),
            citation_url=frontmatter.get("resource", ""),
            concept_type=frontmatter.get("type", ""),
        )
        self._content_cache[cache_key] = doc
        return doc

    @staticmethod
    def _split_frontmatter(raw: str) -> tuple[dict, str]:
        lines = raw.splitlines()
        if lines and lines[0].strip() == "---":
            end = -1
            for i in range(1, len(lines)):
                if lines[i].strip() == "---":
                    end = i
                    break
            if end > 0:
                fm_block = "\n".join(lines[1:end])
                body = "\n".join(lines[end + 1:])
                try:
                    fm = yaml.safe_load(fm_block) or {}
                except yaml.YAMLError:
                    fm = {}
                return fm, body
        return {}, raw

    def list_all_concepts(self) -> list[OKFDocument]:
        """Return all OKF concepts for complete index traversal."""
        results: list[OKFDocument] = []
        for rel_path in self._index_map.values():
            stem = rel_path.replace(".md", "").lstrip("/")
            doc = self.get_concept(stem)
            if doc:
                results.append(doc)
        return results

