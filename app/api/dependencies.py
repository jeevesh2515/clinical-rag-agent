from functools import lru_cache
from pathlib import Path

from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.core.config import get_settings
from app.okf.interface import KnowledgeInterface
from app.retrieval.store import create_store


_OKF_ROOT = Path(__file__).resolve().parent.parent.parent / "hypertension-okf"


@lru_cache
def get_store() -> object:
    return create_store(get_settings())

@lru_cache
def get_knowledge_interface() -> KnowledgeInterface | None:
    okf_path = _OKF_ROOT
    if okf_path.exists() and (okf_path / "INDEX.md").exists():
        return KnowledgeInterface.from_settings(okf_path, get_store())
    return None


def get_agent() -> ClinicalRAGAgent:
    return ClinicalRAGAgent(
        get_settings(),
        get_store(),
        knowledge=get_knowledge_interface(),
    )
