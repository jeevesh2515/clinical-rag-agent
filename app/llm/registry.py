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
        badge="Default",
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
    # ── OpenRouter free-tier models ───────────────────────────────────────────
    ModelSpec(
        id="openrouter-llama-3.1-8b",
        label="Llama 3.1 8B (Free)",
        provider="openrouter",
        description="Meta Llama 3.1 8B — OpenRouter free tier, no cost",
        model_param="meta-llama/llama-3.1-8b-instruct:free",
        badge="Free",
    ),
    ModelSpec(
        id="openrouter-mistral-7b",
        label="Mistral 7B (Free)",
        provider="openrouter",
        description="Mistral 7B Instruct — OpenRouter free tier, no cost",
        model_param="mistralai/mistral-7b-instruct:free",
        badge="Free",
    ),
    ModelSpec(
        id="openrouter-gemma-3-12b",
        label="Gemma 3 12B (Free)",
        provider="openrouter",
        description="Google Gemma 3 12B — OpenRouter free tier, no cost",
        model_param="google/gemma-3-12b-it:free",
        badge="Free",
    ),
    ModelSpec(
        id="openrouter-deepseek-r1",
        label="DeepSeek R1 (Free)",
        provider="openrouter",
        description="DeepSeek R1 reasoning model — OpenRouter free tier",
        model_param="deepseek/deepseek-r1:free",
        badge="Free",
    ),
]


# Default to the first OpenRouter free model so the app works out of the box
# without any paid API key. Falls back to cohere-command-a if openrouter key set.
DEFAULT_MODEL_ID = "openrouter-llama-3.1-8b"


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
        out.append({
            "id": m.id,
            "label": m.label,
            "provider": m.provider,
            "description": m.description,
            "badge": m.badge,
            "configured": llm.is_configured,
        })
    return out
