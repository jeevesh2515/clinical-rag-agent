from functools import lru_cache

from app.agents.clinical_rag_agent import ClinicalRAGAgent
from app.core.config import get_settings
from app.retrieval.store import HybridStore


@lru_cache
def get_store() -> HybridStore:
    return HybridStore(get_settings())


def get_agent() -> ClinicalRAGAgent:
    return ClinicalRAGAgent(get_settings(), get_store())
