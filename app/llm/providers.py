"""LLM provider abstractions.

Each provider implements a single ``chat()`` method that takes a list of
``{"role": ..., "content": ...}`` messages and returns a string answer. The
provider also reports whether it is currently usable (API key configured) and
its friendly name, so the frontend can render the model picker correctly.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Any, Protocol

from app.core.config import Settings

logger = logging.getLogger(__name__)


@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class ProviderError(RuntimeError):
    """Raised when a provider cannot complete the request."""


class ProviderNotConfiguredError(ProviderError):
    """Raised when the provider's API key is not set."""


class LLM(Protocol):
    name: str
    is_configured: bool

    def chat(
        self,
        messages: list[ChatMessage],
        *,
        temperature: float = 0.2,
        max_tokens: int = 1200,
    ) -> str: ...


# ─── Cohere ───────────────────────────────────────────────────────────────────
class CohereLLM:
    name = "cohere"
    is_configured: bool

    def __init__(self, model_id: str, settings: Settings) -> None:
        self.model_id = model_id
        self._api_key = settings.cohere_api_key
        self.is_configured = bool(self._api_key)
        self._client: Any | None = None
        if self.is_configured:
            try:
                import cohere  # type: ignore
                self._client = cohere.ClientV2(api_key=self._api_key)
            except Exception as exc:
                logger.warning("cohere_init_failed err=%s", exc)
                self.is_configured = False

    def chat(self, messages, *, temperature=0.2, max_tokens=1200) -> str:
        if not self.is_configured:
            raise ProviderNotConfiguredError("Cohere API key is not configured")
        if self._client is None:
            raise ProviderNotConfiguredError("Cohere client is not available")

        # Cohere's chat API uses a single message array; first system message
        # becomes the preamble. We keep things simple and just pass through.
        cohere_messages = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("system", "user", "assistant")
        ]
        try:
            response = self._client.chat(
                model=self.model_id,
                messages=cohere_messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
        except Exception as exc:
            raise ProviderError(f"Cohere chat failed: {exc}") from exc

        # Cohere's V2 response structure: response.message.content[0].text
        try:
            return response.message.content[0].text.strip()
        except Exception:
            try:
                return response.text.strip()  # fallback for older clients
            except Exception as exc:
                raise ProviderError("Could not parse Cohere response") from exc


# ─── OpenAI ───────────────────────────────────────────────────────────────────
class OpenAILLM:
    name = "openai"
    is_configured: bool

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self._api_key = os.getenv("OPENAI_API_KEY")
        self.is_configured = bool(self._api_key)
        self._client: Any | None = None
        if self.is_configured:
            try:
                from openai import OpenAI  # type: ignore
                self._client = OpenAI(api_key=self._api_key)
            except Exception as exc:
                logger.warning("openai_init_failed err=%s", exc)
                self.is_configured = False

    def chat(self, messages, *, temperature=0.2, max_tokens=1200) -> str:
        if not self.is_configured or self._client is None:
            raise ProviderNotConfiguredError("OpenAI API key is not configured")
        try:
            response = self._client.chat.completions.create(
                model=self.model_id,
                messages=[{"role": m.role, "content": m.content} for m in messages],
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return (response.choices[0].message.content or "").strip()
        except Exception as exc:
            raise ProviderError(f"OpenAI chat failed: {exc}") from exc


# ─── Anthropic ────────────────────────────────────────────────────────────────
class AnthropicLLM:
    name = "anthropic"
    is_configured: bool

    def __init__(self, model_id: str) -> None:
        self.model_id = model_id
        self._api_key = os.getenv("ANTHROPIC_API_KEY")
        self.is_configured = bool(self._api_key)
        self._client: Any | None = None
        if self.is_configured:
            try:
                from anthropic import Anthropic  # type: ignore
                self._client = Anthropic(api_key=self._api_key)
            except Exception as exc:
                logger.warning("anthropic_init_failed err=%s", exc)
                self.is_configured = False

    def chat(self, messages, *, temperature=0.2, max_tokens=1200) -> str:
        if not self.is_configured or self._client is None:
            raise ProviderNotConfiguredError("Anthropic API key is not configured")
        # Anthropic separates system from user/assistant
        system = next((m.content for m in messages if m.role == "system"), None)
        convo = [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ]
        try:
            kwargs: dict[str, Any] = {
                "model": self.model_id,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "messages": convo,
            }
            if system:
                kwargs["system"] = system
            response = self._client.messages.create(**kwargs)
            # response.content is a list of blocks
            parts = []
            for block in response.content:
                if getattr(block, "type", None) == "text":
                    parts.append(block.text)
            return "".join(parts).strip()
        except Exception as exc:
            raise ProviderError(f"Anthropic chat failed: {exc}") from exc


# ─── Google Gemini ────────────────────────────────────────────────────────────
class GeminiLLM:
    name = "google"
    is_configured: bool

    def __init__(self, model_id: str) -> None:
        # Strip optional "models/" prefix that some SDKs add
        self.model_id = model_id.replace("models/", "")
        self._api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        self.is_configured = bool(self._api_key)
        self._client: Any | None = None
        if self.is_configured:
            try:
                import google.generativeai as genai  # type: ignore
                genai.configure(api_key=self._api_key)
                self._client = genai.GenerativeModel(self.model_id)
            except Exception as exc:
                logger.warning("gemini_init_failed err=%s", exc)
                self.is_configured = False

    def chat(self, messages, *, temperature=0.2, max_tokens=1200) -> str:
        if not self.is_configured or self._client is None:
            raise ProviderNotConfiguredError("Google API key is not configured")
        # Gemini uses a different content format; we just concatenate messages
        prompt_parts = []
        for m in messages:
            role = "user" if m.role in ("system", "user") else "model"
            prompt_parts.append(f"[{role}]\n{m.content}\n")
        try:
            gen_cfg: Any = {"temperature": temperature, "max_output_tokens": max_tokens}
            response = self._client.generate_content(
                "\n".join(prompt_parts),
                generation_config=gen_cfg,
            )
            return (response.text or "").strip()
        except Exception as exc:
            raise ProviderError(f"Gemini chat failed: {exc}") from exc


# ─── OpenRouter ───────────────────────────────────────────────────────────────
class OpenRouterLLM:
    """OpenAI-compatible REST provider for OpenRouter.ai.

    OpenRouter exposes hundreds of models (including free-tier models like
    Llama 3.1 8B, Mistral 7B, Gemma 3 12B) through an OpenAI-compatible
    ``/chat/completions`` endpoint. No extra SDK is needed — we use the
    ``requests`` standard library only.

    Free models have no credit cost but may have rate limits. Set
    ``OPENROUTER_API_KEY`` in ``.env`` to enable.
    """

    name = "openrouter"
    is_configured: bool

    # Required HTTP referrer for OpenRouter policies
    _SITE_URL = "https://clinical-workflows.vercel.app"
    _SITE_NAME = "Clinical RAG Agent"
    _BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, model_id: str, settings: Settings) -> None:
        self.model_id = model_id
        self._api_key = settings.openrouter_api_key or os.getenv("OPENROUTER_API_KEY")
        self.is_configured = bool(self._api_key)

    def chat(self, messages, *, temperature=0.2, max_tokens=1200) -> str:
        if not self.is_configured:
            raise ProviderNotConfiguredError(
                "OPENROUTER_API_KEY is not set. Add it to .env to enable OpenRouter models."
            )
        import json as _json
        import urllib.request as _urllib

        payload = _json.dumps({
            "model": self.model_id,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }).encode()

        req = _urllib.Request(
            self._BASE_URL,
            data=payload,
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": self._SITE_URL,
                "X-Title": self._SITE_NAME,
            },
            method="POST",
        )
        try:
            with _urllib.urlopen(req, timeout=60) as resp:
                data = _json.loads(resp.read())
            return (data["choices"][0]["message"]["content"] or "").strip()
        except Exception as exc:
            raise ProviderError(f"OpenRouter chat failed: {exc}") from exc


class DummyEvalLLM:
    """Deterministic fallback for eval scoring when no real LLM is configured."""
    is_configured = False

    def chat(self, messages, **kwargs) -> str:
        return "0.5"


def get_llm_for_eval(settings: Settings | None = None) -> CohereLLM | OpenRouterLLM | DummyEvalLLM:
    """Cheapest available LLM for evaluator scoring."""
    if settings is None:
        from app.core.config import get_settings
        settings = get_settings()
    if settings.openrouter_api_key:
        return OpenRouterLLM("openrouter/neversleep/llama-3.1-lumimaid-8b", settings)
    if settings.cohere_api_key:
        return CohereLLM("command-a-03-2025", settings)
    return DummyEvalLLM()
