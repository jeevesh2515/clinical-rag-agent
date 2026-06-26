from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    log_level: str = "INFO"

    pinecone_api_key: str | None = Field(default=None, repr=False)
    pinecone_index_name: str = "clinical-rag-hybrid"
    pinecone_cloud: str = "aws"
    pinecone_region: str = "us-east-1"

    cohere_api_key: str | None = Field(default=None, repr=False)
    tavily_api_key: str | None = Field(default=None, repr=False)
    database_url: str = Field(default="sqlite:///./clinical_demo.db", repr=False)

    embedding_model: str = "embed-v4.0"
    embedding_dim: int = 1536
    rerank_model: str = "rerank-v3.5"
    generation_model: str = "command-a-03-2025"

    default_alpha: float = Field(default=0.55, ge=0.0, le=1.0)
    default_top_k: int = Field(default=20, ge=1, le=100)
    default_rerank_top_n: int = Field(default=6, ge=1, le=20)

    cors_origins: str = Field(
        default="http://localhost:5173",
        description="Comma-separated list of allowed CORS origins. Default includes local frontend dev server.",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
