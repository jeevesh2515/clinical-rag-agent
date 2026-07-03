from app.cases.models import SyntheticCase
from app.cases.synthetic_cases import SYNTHETIC_CASES


class CaseRepository:
    """Loads synthetic patient cases for the agent workflow.

    Currently reads from in-memory fixtures. Future: SQLite/Postgres.
    """

    @staticmethod
    def load(case_id: str) -> SyntheticCase | None:
        return SYNTHETIC_CASES.get(case_id)

    @staticmethod
    def list_available() -> list[str]:
        return list(SYNTHETIC_CASES.keys())
