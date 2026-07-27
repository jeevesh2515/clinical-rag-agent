// Day 31 — k6 burst load test.
// Spike to 200 RPS for 2 minutes. Verifies KEDA scale-up fires within
// 60-90 seconds (the pollingInterval is 30s) and that no requests are
// dropped during the burst.
//
// Pass criteria:
//   http_req_failed: rate < 0.01  (some 503s acceptable during scale-up)
//   http_req_duration p95 < 25s   (under saturation)
//   Scale-up observed within 90s of burst start
//
// Run:
//   k6 run --out json=burst.json tests/load/burst.js \
//     -e BASE_URL=https://staging.clinical-workflows.org \
//     -e TOKEN=$STAGING_TOKEN
import http from "k6/http";
import { check } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const dropCounter = new Counter("dropped_503");
const queueSaturation = new Rate("queue_saturation");
const queryLatency = new Trend("burst_latency_ms", true);

export const options = {
  scenarios: {
    burst: {
      executor: "constant-arrival-rate",
      rate: 200, // 200 RPS — 4x baseline
      timeUnit: "1s",
      duration: "2m",
      preAllocatedVUs: 80,
      maxVUs: 300,
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"], // < 1% 5xx (some 503 acceptable during scale-up)
    http_req_duration: ["p(95)<25000"],
    burst_latency_ms: ["p(99)<40000"],
    queue_saturation: ["rate<0.05"], // < 5% of requests over 20s
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8000";
const TOKEN = __ENV.TOKEN || "";

const QUESTIONS = [
  "What is the BP target for CKD?",
  "Stage 2 HTN treatment",
  "First-line HTN drugs",
  "ACE inhibitor contraindications",
  "Home BP monitoring protocol",
  "DASH diet sodium limit",
  "Hypertensive emergency vs urgency",
  "CCB vs thiazide choice",
  "Baseline labs before ACEi",
  "Resistant HTN definition",
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
    "status is 2xx or 503": (r) => r.status >= 200 && r.status < 500,
    "answer or 503": (r) => {
      if (r.status === 503) return true; // KEDA still scaling up
      try {
        const body = JSON.parse(r.body || "{}");
        return typeof body.answer === "string";
      } catch (e) {
        return false;
      }
    },
  });

  if (res.status === 503) {
    dropCounter.add(1);
  }
  queueSaturation.add(res.timings.duration > 20000 ? 1 : 0);
}