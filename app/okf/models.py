from typing import Literal

from pydantic import BaseModel, Field

OKFSourceType = Literal["okf", "rag"]
QueryPath = Literal["okf", "rag", "okf_then_rag"]


class OKFDocument(BaseModel):
    source_path: str = Field(description="Relative path of the OKF concept file")
    source_type: OKFSourceType = Field(default="okf")
    title: str = Field(default="", description="Concept title from frontmatter")
    content: str = Field(default="", description="Full markdown content of the concept file")
    tags: list[str] = Field(default_factory=list, description="Tags from YAML frontmatter")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0)
    citation_url: str = Field(default="", description="Canonical source URL from frontmatter")
    concept_type: str = Field(default="", description="Type field from YAML frontmatter")


class RouterDecision(BaseModel):
    path: QueryPath = Field(description="Which retrieval path to take")
    reason: str = Field(description="Short explanation for the routing decision")
    matched_tags: list[str] = Field(default_factory=list, description="Tags that triggered OKF match")
    okf_concepts: list[str] = Field(default_factory=list, description="Resolved OKF concept paths")


class RAGResult(BaseModel):
    source_path: str = Field(description="Chunk ID or source identifier")
    source_type: OKFSourceType = Field(default="rag")
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    citation_url: str = Field(default="", description="Source URL from metadata")
    content: str = Field(default="", description="Chunk text content")


class KnowledgeResult(BaseModel):
    okf_docs: list[OKFDocument] = Field(default_factory=list)
    rag_chunks: list[RAGResult] = Field(default_factory=list)
    decision: RouterDecision | None = Field(default=None)
    merged_content: str = Field(
        default="", description="Merged context for the generation LLM"
    )
