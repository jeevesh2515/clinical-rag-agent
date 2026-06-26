import logging

from app.core.config import get_settings

_SENSITIVE_LOGGERS = [
    "httpx",
    "httpcore",
    "openai",
    "cohere",
    "urllib3",
    "chardet",
]


def configure_logging() -> None:
    settings = get_settings()
    logging.basicConfig(
        level=settings.log_level,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    for logger_name in _SENSITIVE_LOGGERS:
        logging.getLogger(logger_name).setLevel(logging.WARNING)
