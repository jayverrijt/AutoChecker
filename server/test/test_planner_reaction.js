import test from 'node:test';
import assert from 'node:assert/strict';
import { app, server, getServerApiKey, botManager } from '../src/index.js';
import { db } from '../src/db.js';

// Setup test server port
const TEST_PORT = 3099;
let baseUrl = `http://127.0.0.1:${TEST_PORT}`;

test.before(async () => {
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => {
      resolve();
    });
  });
});

test.after(async () => {
  botManager.stopPolling();
  await new Promise((resolve) => {
    server.close(() => {
      resolve();
    });
  });
});

test('1. Security: REST API rejects requests without Server Auth Token (401)', async () => {
  const res = await fetch(`${baseUrl}/api/shifts`);
  assert.equal(res.status, 401, 'Should return 401 Unauthorized without token');

  const json = await res.json();
  assert.equal(json.ok, false);
  assert.match(json.error, /Niet geautoriseerd/i);
});

test('2. Security: REST API accepts requests with valid x-api-key header (200)', async () => {
  const apiKey = getServerApiKey();
  const res = await fetch(`${baseUrl}/api/shifts`, {
    headers: {
      'x-api-key': apiKey
    }
  });
  assert.equal(res.status, 200, 'Should return 200 OK with valid api key');
  const shifts = await res.json();
  assert.equal(typeof shifts, 'object');
});

test('3. Security: Auth verification endpoint validates keys correctly', async () => {
  const apiKey = getServerApiKey();

  // Test invalid key
  const invalidRes = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wrong-key-123' })
  });
  assert.equal(invalidRes.status, 401);

  // Test valid key
  const validRes = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: apiKey })
  });
  assert.equal(validRes.status, 200);
  const json = await validRes.json();
  assert.equal(json.ok, true);
  assert.equal(json.authenticated, true);
});

test('4. DayPlannerSender Emulation: Morning Shift (M1) Trigger & Sub-Second Reaction', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-25'; // Test Sunday
  const testDateNl = '25-10-2026';

  // 1. Setup user schedule on server: M1 vrijcheckActive = true
  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M1: { block: 'M1', startTime: '06:30', endTime: '09:15', vrijcheckActive: true },
    M2: { block: 'M2', startTime: '09:15', endTime: '12:00', vrijcheckActive: false },
    S1: { block: 'S1', startTime: '14:00', endTime: '16:45', vrijcheckActive: false },
    S2: { block: 'S2', startTime: '16:45', endTime: '19:30', vrijcheckActive: false },
    S3: { block: 'S3', startTime: '19:30', endTime: '22:15', vrijcheckActive: false }
  };
  db.saveShifts(initialShifts);

  // 2. Emulate Day-Planning-Sender posting for OCHTEND with random jitter (50ms - 150ms)
  const emulateRes = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'OCHTEND',
      date: testDateNl,
      minDelayMs: 50,
      maxDelayMs: 150,
      isSimulation: true
    })
  });

  assert.equal(emulateRes.status, 200);
  const data = await emulateRes.json();
  assert.equal(data.ok, true);

  const { benchmark, result } = data.emulation;
  console.log(`\n  ⚡ [BENCHMARK M1] Simulated Jitter: ${benchmark.simulatedJitterMs}ms | Reaction Processing: ${benchmark.reactionProcessingMs}ms | Total Time: ${benchmark.totalReactionTimeMs}ms`);

  // 3. Verify match and reaction emoji
  assert.equal(benchmark.reactionSuccess, true, 'Reaction should succeed');
  assert.equal(benchmark.matchedShift, 'M1', 'Matched shift should be M1');
  assert.equal(benchmark.emoji, '1-red', 'Shift M1 must react with :1-red:');
  assert.ok(benchmark.reactionProcessingMs < 300, `Reaction processing time must be fast (< 300ms, was ${benchmark.reactionProcessingMs}ms)`);

  // 4. Verify database updated with reaction status
  const updatedShifts = db.getShifts();
  const m1Status = updatedShifts[testDateIso]?.M1?.reactionStatus;
  assert.ok(m1Status, 'Reaction status must be saved on shift');
  assert.equal(m1Status.success, true);
  assert.equal(m1Status.emoji, '1-red');
});

test('5. DayPlannerSender Emulation: Afternoon Shift (S3) Trigger with Emoji 3-red', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-26'; // Test Monday
  const testDateNl = '26-10-2026';

  // Setup user schedule: S3 vrijcheckActive = true
  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M1: { block: 'M1', vrijcheckActive: false },
    M2: { block: 'M2', vrijcheckActive: false },
    S1: { block: 'S1', vrijcheckActive: false },
    S2: { block: 'S2', vrijcheckActive: false },
    S3: { block: 'S3', startTime: '19:30', endTime: '22:15', vrijcheckActive: true }
  };
  db.saveShifts(initialShifts);

  // Emulate Day-Planning-Sender posting for MIDDAG
  const emulateRes = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'MIDDAG',
      date: testDateNl,
      minDelayMs: 60,
      maxDelayMs: 120,
      isSimulation: true
    })
  });

  const data = await emulateRes.json();
  const { benchmark } = data.emulation;
  console.log(`  ⚡ [BENCHMARK S3] Simulated Jitter: ${benchmark.simulatedJitterMs}ms | Reaction Processing: ${benchmark.reactionProcessingMs}ms | Total Time: ${benchmark.totalReactionTimeMs}ms`);

  assert.equal(benchmark.reactionSuccess, true);
  assert.equal(benchmark.matchedShift, 'S3');
  assert.equal(benchmark.emoji, '3-red', 'Shift S3 must react with :3-red:');
});

test('6. DayPlannerSender Emulation: Vrijcheck Disabled on Shift (Safely Ignored)', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-27';
  const testDateNl = '27-10-2026';

  // Setup user shift with vrijcheckActive = FALSE
  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M1: { block: 'M1', vrijcheckActive: false },
    M2: { block: 'M2', vrijcheckActive: false }
  };
  db.saveShifts(initialShifts);

  const emulateRes = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'OCHTEND',
      date: testDateNl,
      isSimulation: true
    })
  });

  const data = await emulateRes.json();
  const { benchmark } = data.emulation;

  assert.equal(benchmark.reactionSuccess, false, 'Should NOT react when vrijcheck is false');
  assert.equal(benchmark.status, 'vrijcheck_disabled');
  assert.match(benchmark.reason, /Vrijcheck staat UIT/i);
});

test('7. DayPlannerSender Emulation: Period Mismatch (Afternoon shift does not react to Morning message)', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-28';
  const testDateNl = '28-10-2026';

  // User has S1 (Afternoon), but morning message arrives
  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    S1: { block: 'S1', vrijcheckActive: true }
  };
  db.saveShifts(initialShifts);

  const emulateRes = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'OCHTEND',
      date: testDateNl,
      isSimulation: true
    })
  });

  const data = await emulateRes.json();
  const { benchmark } = data.emulation;

  assert.equal(benchmark.reactionSuccess, false);
  assert.equal(benchmark.status, 'no_shift');
});

test('8. Multi-run Latency Stress Test (5 consecutive emulations with random jitter)', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-29';
  const testDateNl = '29-10-2026';

  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M2: { block: 'M2', vrijcheckActive: true }
  };
  db.saveShifts(initialShifts);

  const latencies = [];

  for (let i = 1; i <= 5; i++) {
    const res = await fetch(`${baseUrl}/api/test/emulate-planner`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify({
        period: 'OCHTEND',
        date: testDateNl,
        minDelayMs: 30,
        maxDelayMs: 160,
        isSimulation: true
      })
    });

    const data = await res.json();
    const benchmark = data.emulation.benchmark;
    latencies.push(benchmark.reactionProcessingMs);
    assert.equal(benchmark.matchedShift, 'M2');
    assert.equal(benchmark.emoji, '2-red');
  }

  const avgLatency = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length);
  console.log(`  ⚡ [MULTI-RUN 5x BENCHMARK] Latencies: [${latencies.join(', ')}] ms | Average: ${avgLatency}ms`);

  assert.ok(avgLatency < 200, `Average reaction latency should be < 200ms (was ${avgLatency}ms)`);
});

test('9. Multi-User Concurrency: Multiple registered runners react simultaneously with isolated schedules', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-30';
  const testDateNl = '30-10-2026';

  // 1. Create Runner A (Pieter) -> Wants M1 vrij
  const runnerAId = 'U_RUNNER_PIETER';
  db.saveUser(runnerAId, {
    userId: runnerAId,
    username: 'pieter_v',
    slackToken: 'xoxc-mock-token-pieter',
    autoReact: true
  });
  db.saveShifts(runnerAId, {
    [testDateIso]: {
      M1: { block: 'M1', vrijcheckActive: true },
      M2: { block: 'M2', vrijcheckActive: false }
    }
  });

  // 2. Create Runner B (Sara) -> Wants M2 vrij
  const runnerBId = 'U_RUNNER_SARA';
  db.saveUser(runnerBId, {
    userId: runnerBId,
    username: 'sara_k',
    slackToken: 'xoxc-mock-token-sara',
    autoReact: true
  });
  db.saveShifts(runnerBId, {
    [testDateIso]: {
      M1: { block: 'M1', vrijcheckActive: false },
      M2: { block: 'M2', vrijcheckActive: true }
    }
  });

  // 3. Create Runner C (Lars) -> Wants no shifts vrij
  const runnerCId = 'U_RUNNER_LARS';
  db.saveUser(runnerCId, {
    userId: runnerCId,
    username: 'lars_t',
    slackToken: 'xoxc-mock-token-lars',
    autoReact: true
  });
  db.saveShifts(runnerCId, {
    [testDateIso]: {
      M1: { block: 'M1', vrijcheckActive: false }
    }
  });

  // Emulate morning post
  const res = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'OCHTEND',
      date: testDateNl,
      isSimulation: true
    })
  });

  assert.equal(res.status, 200);
  const data = await res.json();
  const runners = data.emulation.result.runners;

  // Verify Runner A got M1 (1-red)
  const pieterResult = runners.find(r => r.userId === runnerAId);
  assert.ok(pieterResult, 'Pieter must be processed');
  assert.equal(pieterResult.matched, true);
  assert.equal(pieterResult.blockId, 'M1');
  assert.equal(pieterResult.emojiName, '1-red');
  assert.equal(pieterResult.reactionSuccess, true);

  // Verify Runner B got M2 (2-red)
  const saraResult = runners.find(r => r.userId === runnerBId);
  assert.ok(saraResult, 'Sara must be processed');
  assert.equal(saraResult.matched, true);
  assert.equal(saraResult.blockId, 'M2');
  assert.equal(saraResult.emojiName, '2-red');
  assert.equal(saraResult.reactionSuccess, true);

  // Verify Runner C was not matched
  const larsResult = runners.find(r => r.userId === runnerCId);
  assert.ok(larsResult);
  assert.equal(larsResult.matched, false);

  // Verify database persistence for each runner individually
  const pieterShifts = db.getShifts(runnerAId);
  assert.equal(pieterShifts[testDateIso]?.M1?.reactionStatus?.success, true);

  const saraShifts = db.getShifts(runnerBId);
  assert.equal(saraShifts[testDateIso]?.M2?.reactionStatus?.success, true);
  assert.equal(saraShifts[testDateIso]?.M1?.reactionStatus, undefined);

  // Verify isolation via REST API endpoints with x-user-id header
  const apiPieterShifts = await (await fetch(`${baseUrl}/api/shifts`, {
    headers: { 'x-api-key': apiKey, 'x-user-id': runnerAId }
  })).json();
  assert.equal(apiPieterShifts[testDateIso]?.M1?.vrijcheckActive, true);

  const apiSaraShifts = await (await fetch(`${baseUrl}/api/shifts`, {
    headers: { 'x-api-key': apiKey, 'x-user-id': runnerBId }
  })).json();
  assert.equal(apiSaraShifts[testDateIso]?.M2?.vrijcheckActive, true);
  assert.equal(apiSaraShifts[testDateIso]?.M1?.vrijcheckActive, false);

  // Clean up test runners
  db.deleteUser(runnerAId);
  db.deleteUser(runnerBId);
  db.deleteUser(runnerCId);
});
