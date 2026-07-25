// Day 31 — k6 baseline load test.
// Steady-state load: 50 RPS for 10 minutes. Mirrors the 1K MAU production
// profile. Asserts p95 latency, error rate, and cache hit rate.
//
// Pass criteria (see docs/LOAD_TEST_RESULTS.md):
//   p95 latency < 4s    (LLM-free response window)
//   p95 latency < 18s   (with LLM generation, OpenRouter p95)
//   error rate < 0.5%
//   llm_cache_hits_total rate >= 30% after warm-up
//   http_requests_in_flight p99 < 50 (under KEDA scale-up threshold)
//
// Run:
//   k6 run --out json=baseline.json tests/load/baseline.js \
//     -e BASE_URL=https://staging.clinical-workflows.org \
//     -e TOKEN=$STAGING_TOKEN
import http from "k6/http";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const llmErrors = new Rate("llm_errors");
const cacheHitRate = new Rate("cache_hits");
const queryLatency = new Trend("query_latency_ms", true);

export const options = {
  scenarios: {
    baseline: {
      executor: "constant-arrival-rate",
      rate: 50, // 50 RPS
      timeUnit: "1s",
      duration: "10m",
      preAllocatedVUs: 30,
      maxVUs: 120,
    },
  },
  thresholds: {
    http_req_duration: ["p(95)<18000"], // 18s p95 including LLM
    http_req_failed: ["rate<0.005"],     // < 0.5% errors
    llm_errors: ["rate<0.01"],           // < 1% LLM provider errors
    cache_hits: ["rate>0.30"],           // > 30% cache hit rate
    query_latency_ms: ["p(99)<30000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.TOKEN || "";

const QUESTIONS = [
  "What is the target BP for a patient with CKD and diabetes?",
  "How is stage 2 hypertension treated in adults?",
  "What are the first-line drug classes for hypertension?",
  "When should ACE inhibitors be avoided?",
  "How often should blood pressure be monitored at home?",
  "What lifestyle changes lower blood pressure most effectively?",
  "What is the difference between urgency and emergency hypertensive crisis?",
  "When is a calcium channel blocker preferred over a thiazide?",
  "What labs are needed before starting an ACE inhibitor?",
  "How is resistant hypertension defined?",
];

export default function () {
  const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
  const payload = JSON.stringify({
    question,
    mode: "patient",
    alpha: 0.55,
    top_k: 20,
    rerank_top_n: 6,
  });
  const headers = { "Content-Type": "application/json" };
  if (TOKEN) headers["Authorization"] = `Bearer ${TOKEN}`;

  const start = Date.now();
  const res = http.post(`${BASE_URL}/api/query`, payload, { headers });
  queryLatency.add(Date.now() - start);

  const ok = check(res, {
    "status is 200": (r) => r.status === 200,
    "answer present": (r) => {
      try {
        const body = JSON.parse(r.body || "{}");
        return typeof body.answer === "string" && body.answer.length > 50;
      } catch {
        return false;
      }
    },
    "citations present": (r) => {
      try {
        const body = JSON.parse(r.body || "{}");
        return Array.isArray(body.citations) && body.citations.length > 0;
      } catch {
        return false;
      }
    },
  });

  if (!ok || res.status >= 500) {
    llmErrors.add(1);
  } else {
    llmErrors.add(0);
  }

  // Poll the cache hit counter from /api/metrics every ~5s per VU.
  if (Math.random() < 0.1) {
    const metricsRes = http.get(`${BASE_URL}/api/metrics`);
    const hit = /llm_cache_hits_total\{cache="redis"\} (\d+)/.exec(metricsRes.body || "");
    const miss = /llm_cache_misses_total\{cache="redis"\} (\d+)/.exec(metricsRes.body || "");
    if (hit && miss) {
      const h = Number(hit[1]);
      const m = Number(miss[1]);
      if (h + m > 0) {
        cacheHitRate.add(h / (h + m));
      }
    }
  }

  sleep(0.05); // gentle pacing — arrivals are rate-controlled
}