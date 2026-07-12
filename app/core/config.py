import os
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
    openrouter_api_key: str | None = Field(default=None, repr=False)
    openai_api_key: str | None = Field(default=None, repr=False)
    anthropic_api_key: str | None = Field(default=None, repr=False)
    google_api_key: str | None = Field(default=None, repr=False)
    database_url: str = Field(default="sqlite:///./clinical_demo.db", repr=False)

    embedding_model: str = "embed-v4.0"
    embedding_dim: int = 1536
    rerank_model: str = "rerank-v3.5"
    generation_model: str = "command-a-03-2025"

    default_alpha: float = Field(default=0.55, ge=0.0, le=1.0)
    default_top_k: int = Field(default=20, ge=1, le=100)
    default_rerank_top_n: int = Field(default=6, ge=1, le=20)

    cors_origins: str = Field(
        default="http://localhost:5173,https://clinical-workflows.vercel.app,https://clinical-workflows-*.vercel.app",
        description="Comma-separated list of allowed CORS origins. Default includes local frontend dev server.",
    )

    # LangSmith Observability
    langchain_tracing_v2: bool = Field(default=False)
    langchain_api_key: str | None = Field(default=None, repr=False)
    langchain_project: str = "clinical-rag-agent"
    langchain_endpoint: str = "https://api.smith.langchain.com"

    # Alias / alternate names copied from LangSmith UI
    langsmith_tracing: str | None = Field(default=None)
    langsmith_api_key: str | None = Field(default=None, repr=False)
    langsmith_project: str | None = Field(default=None)
    langsmith_endpoint: str | None = Field(default=None)

    def __init__(self, **values):
        super().__init__(**values)
        # Standardise key values between LANGCHAIN_ and LANGSMITH_ env prefixes
        tracing_str = self.langsmith_tracing
        tracing_enabled = self.langchain_tracing_v2 or (
            tracing_str.lower() == "true" if tracing_str else False
        )
        api_key = self.langchain_api_key or self.langsmith_api_key
        project = self.langsmith_project or self.langchain_project or "clinical-rag-agent"
        endpoint = self.langsmith_endpoint or self.langchain_endpoint or "https://api.smith.langchain.com"

        # Strip any quotes from the project name (e.g. '"clinical-rag-agent"')
        if project:
            project = project.strip("\"'")

        if tracing_enabled and api_key:
            os.environ["LANGCHAIN_TRACING_V2"] = "true"
            os.environ["LANGCHAIN_API_KEY"] = api_key
            os.environ["LANGCHAIN_PROJECT"] = project
            os.environ["LANGCHAIN_ENDPOINT"] = endpoint


@lru_cache
def get_settings() -> Settings:
    return Settings()
