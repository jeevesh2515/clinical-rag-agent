import hashlib
import math
import re
from collections import Counter, defaultdict


TOKEN_PATTERN = re.compile(r"[a-zA-Z0-9]+")


def tokenize(text: str) -> list[str]:
    return [token.lower() for token in TOKEN_PATTERN.findall(text)]


class BM25SparseEncoder:
    def __init__(self, dim: int = 50000, k1: float = 1.5, b: float = 0.75) -> None:
        self.dim = dim
        self.k1 = k1
        self.b = b
        self.doc_freq: Counter[str] = Counter()
        self.doc_count = 0
        self.avg_doc_len = 1.0
        self._fitted = False

    def fit(self, documents: list[str]) -> "BM25SparseEncoder":
        lengths = []
        df: Counter[str] = Counter()
        for document in documents:
            tokens = tokenize(document)
            lengths.append(len(tokens))
            df.update(set(tokens))
        self.doc_freq = df
        self.doc_count = max(1, len(documents))
        self.avg_doc_len = sum(lengths) / max(1, len(lengths))
        self._fitted = True
        return self

    def encode_document(self, text: str) -> dict[str, list[float] | list[int]]:
        tokens = tokenize(text)
        counts = Counter(tokens)
        values_by_index: dict[int, float] = defaultdict(float)
        doc_len = max(1, len(tokens))
        for token, tf in counts.items():
            idf = self._idf(token)
            denom = tf + self.k1 * (1 - self.b + self.b * doc_len / self.avg_doc_len)
            weight = idf * (tf * (self.k1 + 1)) / denom
            values_by_index[self._hash_token(token)] += weight
        return self._to_sparse(values_by_index)

    def encode_query(self, text: str) -> dict[str, list[float] | list[int]]:
        counts = Counter(tokenize(text))
        values_by_index: dict[int, float] = defaultdict(float)
        for token, tf in counts.items():
            values_by_index[self._hash_token(token)] += self._idf(token) * math.sqrt(tf)
        return self._to_sparse(values_by_index)

    def _idf(self, token: str) -> float:
        if not self._fitted:
            return 1.0
        df = self.doc_freq.get(token, 0)
        return math.log(1 + (self.doc_count - df + 0.5) / (df + 0.5))

    def _hash_token(self, token: str) -> int:
        digest = hashlib.blake2b(token.encode("utf-8"), digest_size=8).hexdigest()
        return int(digest, 16) % self.dim

    @staticmethod
    def _to_sparse(values_by_index: dict[int, float]) -> dict[str, list[float] | list[int]]:
        items = sorted((idx, value) for idx, value in values_by_index.items() if value > 0)
        return {
            "indices": [idx for idx, _ in items],
            "values": [float(value) for _, value in items],
        }


def sparse_dot(left: dict[str, list], right: dict[str, list]) -> float:
    right_values = dict(zip(right.get("indices", []), right.get("values", []), strict=False))
    return float(
        sum(value * right_values.get(index, 0.0) for index, value in zip(left.get("indices", []), left.get("values", []), strict=False))
    )
