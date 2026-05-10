// k6 load scenario for signup → first-message (S-188).
//
// Run:
//   COPYME_TARGET=https://preview-url.vercel.app k6 run scripts/load/k6-signup.js
//
// Acceptance: p95 latency < 600ms on signup; 5xx rate < 0.1%; ramps 1k → 10k VUs.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

export const options = {
  thresholds: {
    'http_req_duration{name:signup_send}': ['p(95)<600'],
    'http_req_failed': ['rate<0.001'],
  },
  stages: [
    { duration: '1m', target: 1000 },
    { duration: '3m', target: 5000 },
    { duration: '5m', target: 10000 },
    { duration: '2m', target: 0 },
  ],
};

const BASE = __ENV.COPYME_TARGET || 'http://localhost:3000';

export default function () {
  // 1. Synthetic phone — server should accept the +386 prefix and dispatch
  //    to the mock provider in non-prod env.
  const phone = `+38631${String(Math.floor(Math.random() * 1e6)).padStart(6, '0')}`;
  const send = http.post(
    `${BASE}/api/auth/phone/send`,
    JSON.stringify({ phoneE164: phone }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'signup_send' } },
  );
  check(send, { 'send 2xx/429': (r) => r.status === 200 || r.status === 429 });

  sleep(1);

  // 2. Verify with a known mock code (only valid in mock provider).
  const verify = http.post(
    `${BASE}/api/auth/phone/verify`,
    JSON.stringify({ phoneE164: phone, code: __ENV.COPYME_MOCK_OTP || '000000' }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'signup_verify' } },
  );
  check(verify, { 'verify 2xx/4xx': (r) => r.status < 500 });

  sleep(2);
}
