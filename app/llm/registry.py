"""Model registry.

The frontend reads ``/api/models`` to know which models are available and
which one is the default. The agent reads ``get_llm(model_id)`` to dispatch
generation. Each entry has:

  - ``id``: the model identifier the client sends in ``QueryRequest.model_id``
  - ``provider``: the provider class
  - ``label``: friendly name for the UI
  - ``description``: one-line description
  - ``model_param``: the actual model string passed to the provider SDK
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Type

from app.core.config import Settings
from app.llm.providers import (
    AnthropicLLM,
    CohereLLM,
    GeminiLLM,
    LLM,
    OpenAILLM,
    OpenRouterLLM,
)


@dataclass
class ModelSpec:
    id: str
    label: str
    provider: str
    description: str
    model_param: str
    badge: str | None = None


# Static catalogue — single source of truth shared with the frontend.
MODELS: list[ModelSpec] = [
    ModelSpec(
        id="cohere-command-a",
        label="Cohere Command A",
        provider="cohere",
        description="Default · grounded, fast, long context",
        model_param="command-a-03-2025",
    ),
    ModelSpec(
        id="cohere-command-r",
        label="Cohere Command R+",
        provider="cohere",
        description="Retrieval-augmented generation, optimized for RAG",
        model_param="command-r-plus",
    ),
    ModelSpec(
        id="openai-gpt-4o",
        label="OpenAI GPT-4o",
        provider="openai",
        description="OpenAI flagship, multimodal",
        model_param="gpt-4o",
    ),
    ModelSpec(
        id="openai-gpt-4o-mini",
        label="OpenAI GPT-4o mini",
        provider="openai",
        description="Faster, cheaper, still strong",
        model_param="gpt-4o-mini",
    ),
    ModelSpec(
        id="anthropic-claude-3.5-sonnet",
        label="Claude 3.5 Sonnet",
        provider="anthropic",
        description="Anthropic's best balance of speed and reasoning",
        model_param="claude-3-5-sonnet-20241022",
    ),
    ModelSpec(
        id="anthropic-claude-3-haiku",
        label="Claude 3 Haiku",
        provider="anthropic",
        description="Fastest Anthropic model",
        model_param="claude-3-haiku-20240307",
    ),
    ModelSpec(
        id="google-gemini-1.5-pro",
        label="Gemini 1.5 Pro",
        provider="google",
        description="Google's long-context model",
        model_param="gemini-1.5-pro",
    ),
    ModelSpec(
        id="google-gemini-1.5-flash",
        label="Gemini 1.5 Flash",
        provider="google",
        description="Fast, cheap, very long context",
        model_param="gemini-1.5-flash",
    ),
    # ── OpenRouter free-tier models (verified working Jul 2026) ───────────────
    # These models are free (prompt=0, completion=0) via OpenRouter.
    ModelSpec(
        id="openrouter-nemotron-ultra-550b",
        label="Nemotron Ultra 550B (Free)",
        provider="openrouter",
        description="Nvidia Nemotron-3 550B — best clinical accuracy, 1M context, free",
        model_param="nvidia/nemotron-3-ultra-550b-a55b:free",
    ),
    ModelSpec(
        id="openrouter-nemotron-nano-30b",
        label="Nemotron Nano 30B (Free)",
        provider="openrouter",
        description="Nvidia Nemotron-3 Nano 30B — fast, accurate, great for RAG",
        model_param="nvidia/nemotron-3-nano-30b-a3b:free",
    ),
    ModelSpec(
        id="openrouter-gemma-4-26b",
        label="Gemma 4 26B (Free)",
        provider="openrouter",
        description="Google Gemma 4 26B — latest Google model, excellent reasoning",
        model_param="google/gemma-4-26b-a4b-it:free",
    ),
    ModelSpec(
        id="openrouter-llama-3.3-70b",
        label="Llama 3.3 70B (Free)",
        provider="openrouter",
        description="Meta Llama 3.3 70B — strong reasoning, 131K context",
        model_param="meta-llama/llama-3.3-70b-instruct:free",
    ),
]


# Default to the most capable verified free model — best clinical RAG at zero cost.
DEFAULT_MODEL_ID = "openrouter-nemotron-ultra-550b"


def get_spec(model_id: str | None) -> ModelSpec:
    if not model_id:
        return next(m for m in MODELS if m.id == DEFAULT_MODEL_ID)
    for m in MODELS:
        if m.id == model_id:
            return m
    return next(m for m in MODELS if m.id == DEFAULT_MODEL_ID)


_PROVIDER_MAP: dict[str, Type[LLM]] = {
    "cohere": CohereLLM,  # type: ignore[type-abstract]
    "openai": OpenAILLM,  # type: ignore[type-abstract]
    "anthropic": AnthropicLLM,  # type: ignore[type-abstract]
    "google": GeminiLLM,  # type: ignore[type-abstract]
    "openrouter": OpenRouterLLM,  # type: ignore[type-abstract]
}


def get_llm(model_id: str | None, settings: Settings) -> LLM:
    """Build the LLM for a model_id, falling back to the default if unparseable."""
    spec = get_spec(model_id)
    cls = _PROVIDER_MAP.get(spec.provider, OpenRouterLLM)
    # Providers that need settings (API key stored on Settings object)
    if spec.provider in ("cohere", "openrouter"):
        return cls(spec.model_param, settings)  # type: ignore[arg-type]
    return cls(spec.model_param)  # type: ignore[arg-type]


def list_models_for_api(settings: Settings) -> list[dict]:
    """Return the catalogue annotated with each model's configured-state."""
    out = []
    for m in MODELS:
        llm = get_llm(m.id, settings)
        if llm.is_configured:  # Only return configured models
            out.append({
                "id": m.id,
                "label": m.label,
                "provider": m.provider,
                "description": m.description,
                "badge": m.badge,
                "is_configured": llm.is_configured,
            })
    return out


