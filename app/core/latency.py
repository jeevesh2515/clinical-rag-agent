"""Latency tracking utilities for per-node duration measurement.

Usage::

    from app.core.latency import Timer

    with Timer() as t:
        do_work()

    print(t.elapsed_ms)  # float — milliseconds

To accumulate per-node durations across an agent invocation::

    durations: dict[str, float] = {}

    with Timer() as t:
        classify_result = classify_query(question)
    durations["classify"] = t.elapsed_ms

    with Timer() as t:
        retrieve_result = retrieve(question)
    durations["retrieve"] = t.elapsed_ms

    # Pass durations into QueryResponse.latency_ms
"""

import time


class Timer:
    """Context manager that records wall-clock elapsed time in milliseconds.

    Attributes:
        elapsed_ms: Duration of the ``with`` block in milliseconds.
                    Set to 0.0 until the block exits.
    """

    elapsed_ms: float

    def __init__(self) -> None:
        self.elapsed_ms = 0.0
        self._start: float = 0.0

    def __enter__(self) -> "Timer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *_: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000.0
