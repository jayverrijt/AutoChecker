import test from 'node:test';
import assert from 'node:assert/strict';
import { app, server, getServerApiKey, botManager } from '../src/index.js';
import { db, extractFirstName } from '../src/db.js';
import { parseIcalContent, parseShiftSummary } from '../src/icalParser.js';

const TEST_PORT = 3099;
const baseUrl = `http://127.0.0.1:${TEST_PORT}`;

test.before(async () => {
  await db.init();
  await new Promise((resolve) => {
    server.listen(TEST_PORT, '127.0.0.1', () => {
      resolve();
    });
  });
});

test.after(async () => {
  botManager.stopPolling();
  await db.waitForFlush();
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

  const invalidRes = await fetch(`${baseUrl}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'wrong-key-123' })
  });
  assert.equal(invalidRes.status, 401);

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
  const testDateIso = '2026-10-25';
  const testDateNl = '25-10-2026';

  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M1: { block: 'M1', startTime: '06:30', endTime: '09:15', vrijcheckActive: true },
    M2: { block: 'M2', startTime: '09:15', endTime: '12:00', vrijcheckActive: false },
    S1: { block: 'S1', startTime: '14:00', endTime: '16:45', vrijcheckActive: false },
    S2: { block: 'S2', startTime: '16:45', endTime: '19:30', vrijcheckActive: false },
    S3: { block: 'S3', startTime: '19:30', endTime: '22:15', vrijcheckActive: false }
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
      minDelayMs: 50,
      maxDelayMs: 150,
      isSimulation: true
    })
  });

  assert.equal(emulateRes.status, 200);
  const data = await emulateRes.json();
  assert.equal(data.ok, true);

  const { benchmark } = data.emulation;
  console.log(
    `\n  ⚡ [BENCHMARK M1] Simulated Jitter: ${benchmark.simulatedJitterMs}ms | Reaction Processing: ${benchmark.reactionProcessingMs}ms | Total Time: ${benchmark.totalReactionTimeMs}ms`
  );

  assert.equal(benchmark.reactionSuccess, true, 'Reaction should succeed');
  assert.equal(benchmark.matchedShift, 'M1', 'Matched shift should be M1');
  assert.equal(benchmark.emoji, '1-red', 'Shift M1 must react with :1-red:');
  assert.ok(
    benchmark.reactionProcessingMs < 300,
    `Reaction processing time must be fast (< 300ms, was ${benchmark.reactionProcessingMs}ms)`
  );

  const updatedShifts = db.getShifts();
  const m1Status = updatedShifts[testDateIso]?.M1?.reactionStatus;
  assert.ok(m1Status, 'Reaction status must be saved on shift');
  assert.equal(m1Status.success, true);
  assert.equal(m1Status.emoji, '1-red');
});

test('5. DayPlannerSender Emulation: Afternoon Shift (S3) Trigger with Emoji 3-red', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-26';
  const testDateNl = '26-10-2026';

  const initialShifts = db.getShifts();
  initialShifts[testDateIso] = {
    M1: { block: 'M1', vrijcheckActive: false },
    M2: { block: 'M2', vrijcheckActive: false },
    S1: { block: 'S1', vrijcheckActive: false },
    S2: { block: 'S2', vrijcheckActive: false },
    S3: { block: 'S3', startTime: '19:30', endTime: '22:15', vrijcheckActive: true }
  };
  db.saveShifts(initialShifts);

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
  console.log(
    `  ⚡ [BENCHMARK S3] Simulated Jitter: ${benchmark.simulatedJitterMs}ms | Reaction Processing: ${benchmark.reactionProcessingMs}ms | Total Time: ${benchmark.totalReactionTimeMs}ms`
  );

  assert.equal(benchmark.reactionSuccess, true);
  assert.equal(benchmark.matchedShift, 'S3');
  assert.equal(benchmark.emoji, '3-red', 'Shift S3 must react with :3-red:');
});

test('6. DayPlannerSender Emulation: Vrijcheck Disabled on Shift (Safely Ignored, No Fake Fail)', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-27';
  const testDateNl = '27-10-2026';

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

  // Bugfix #1 & #4: Ensure no fake FAILED record was added to vrijcheck_requests for 2026-10-27
  const requests = db.getVrijcheckRequests();
  const fakeFail = requests.find((r) => r.shiftDate === testDateIso);
  assert.equal(fakeFail, undefined, 'Unrequested shifts must NEVER appear in vrijcheck_requests');
});

test('7. DayPlannerSender Emulation: Period Mismatch (Afternoon shift does not react to Morning message)', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-28';
  const testDateNl = '28-10-2026';

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

  const pieterResult = runners.find((r) => r.userId === runnerAId);
  assert.ok(pieterResult, 'Pieter must be processed');
  assert.equal(pieterResult.matched, true);
  assert.equal(pieterResult.blockId, 'M1');
  assert.equal(pieterResult.emojiName, '1-red');
  assert.equal(pieterResult.reactionSuccess, true);

  const saraResult = runners.find((r) => r.userId === runnerBId);
  assert.ok(saraResult, 'Sara must be processed');
  assert.equal(saraResult.matched, true);
  assert.equal(saraResult.blockId, 'M2');
  assert.equal(saraResult.emojiName, '2-red');
  assert.equal(saraResult.reactionSuccess, true);

  const larsResult = runners.find((r) => r.userId === runnerCId);
  assert.ok(larsResult);
  assert.equal(larsResult.matched, false);

  const pieterShifts = db.getShifts(runnerAId);
  assert.equal(pieterShifts[testDateIso]?.M1?.reactionStatus?.success, true);

  const saraShifts = db.getShifts(runnerBId);
  assert.equal(saraShifts[testDateIso]?.M2?.reactionStatus?.success, true);
  assert.equal(saraShifts[testDateIso]?.M1?.reactionStatus, undefined);

  db.deleteUser(runnerAId);
  db.deleteUser(runnerBId);
  db.deleteUser(runnerCId);
});

test('10. v2.0 All 64 Dutch Hubs & Critical Rule HLM=Helmond / HAA=Haarlem', async () => {
  const res = await fetch(`${baseUrl}/api/hubs`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.count, 64, 'Must support all 64 Dutch Picnic Hubs');

  const hlm = data.hubs.find((h) => h.code === 'HLM');
  const haa = data.hubs.find((h) => h.code === 'HAA');
  assert.equal(hlm?.name, 'Helmond', 'HLM must ALWAYS be Helmond');
  assert.equal(haa?.name, 'Haarlem', 'HAA must be Haarlem');
});

test('11. v2.0 Smart iCal Parsing & Uncoupling Combined Shifts (M1-M2, S1-S2-S3)', async () => {
  const s123 = parseShiftSummary('Trip shift S1-S2-S3 at HLM Picnic');
  assert.deepEqual(s123.blocks, ['S1', 'S2', 'S3']);
  assert.equal(s123.hub, 'HLM');
  assert.equal(s123.isCombined, true);

  const m12 = parseShiftSummary('Trip shift M1-M2 at EIN Picnic');
  assert.deepEqual(m12.blocks, ['M1', 'M2']);
  assert.equal(m12.hub, 'EIN');

  const rawIcal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:shift-combined-1@picnic.nl',
    'DTSTART:20261102T130000Z',
    'DTEND:20261102T211500Z',
    'SUMMARY:Trip shift S1-S2-S3 at HLM Picnic',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:shift-double-2@picnic.nl',
    'DTSTART:20261103T053000Z',
    'DTEND:20261103T110000Z',
    'SUMMARY:Trip shift M1-M2 at HLM Picnic',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const parsedShifts = parseIcalContent(rawIcal, 'HLM');
  assert.equal(parsedShifts.length, 5, 'Combined S1-S2-S3 (3) + M1-M2 (2) must uncouple into 5 individual shifts');
  assert.deepEqual(
    parsedShifts.map((s) => `${s.shiftDate}:${s.shiftBlock}`),
    ['2026-11-02:S1', '2026-11-02:S2', '2026-11-02:S3', '2026-11-03:M1', '2026-11-03:M2']
  );
});

test('12. v2.0 Onboarding Validation (Rejects @teampicnic.com email & extracts firstName)', async () => {
  const apiKey = getServerApiKey();

  assert.equal(extractFirstName('Jay Verrijt', ''), 'Jay');
  assert.equal(extractFirstName('', 'Pieter Jansen'), 'Pieter');
  assert.equal(extractFirstName('', ''), 'Runner');

  const badEmailRes = await fetch(`${baseUrl}/api/onboarding/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-user-id': 'U_TEST_ONBOARD'
    },
    body: JSON.stringify({
      firstName: 'Jay',
      personalEmail: 'jay@teampicnic.com',
      hubCode: 'HLM'
    })
  });
  assert.equal(badEmailRes.status, 400, 'Must reject @teampicnic.com email');

  const goodRes = await fetch(`${baseUrl}/api/onboarding/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-user-id': 'U_TEST_ONBOARD'
    },
    body: JSON.stringify({
      firstName: 'Jay',
      personalEmail: 'jay@gmail.com',
      hubCode: 'HLM'
    })
  });
  assert.equal(goodRes.status, 200);
  const goodData = await goodRes.json();
  assert.equal(goodData.ok, true);
  assert.equal(goodData.user.onboardingCompleted, true);

  db.deleteUser('U_TEST_ONBOARD');
});

test('13. v2.0 Automatic :picnic: Reaction on Working Shifts & Pre-Split iCal VEVENTs', async () => {
  const apiKey = getServerApiKey();
  const testDateIso = '2026-10-27';
  const testDateNl = '27-10-2026';
  const runnerId = 'U_TEST_PICNIC_WORK';

  // 1. Verify pre-split VEVENTs (2 separate VEVENTs both named "Trip shift S1-S2 at HLM Picnic")
  // map 1-to-1 to S1 and S2 with exact individual start/end times
  const preSplitIcal = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:SH01M5X4F7XCWYE71MF5GS85WBH8',
    'DTSTART:20261027T130519Z',
    'DTEND:20261027T153357Z',
    'SUMMARY:Trip shift S1-S2 at HLM Picnic',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:SH01M5X4F7S1SVQ8NY10GKR75G76',
    'DTSTART:20261027T155357Z',
    'DTEND:20261027T181939Z',
    'SUMMARY:Trip shift S1-S2 at HLM Picnic',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:SH01M5X4F7R11EYTPA357935MGF1',
    'DTSTART:20261027T183939Z',
    'DTEND:20261027T204715Z',
    'SUMMARY:Trip shift S3 at HLM Picnic',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const parsedPreSplit = parseIcalContent(preSplitIcal, 'HLM');
  assert.equal(parsedPreSplit.length, 3);
  assert.equal(parsedPreSplit[0].shiftBlock, 'S1');
  assert.equal(parsedPreSplit[0].startTime, '14:05');
  assert.equal(parsedPreSplit[1].shiftBlock, 'S2');
  assert.equal(parsedPreSplit[1].startTime, '16:53');
  assert.equal(parsedPreSplit[2].shiftBlock, 'S3');
  assert.equal(parsedPreSplit[2].startTime, '19:39');

  // 2. Test automatic :picnic: reaction when autoPicnicReact is enabled (default true)
  db.saveUser(runnerId, {
    userId: runnerId,
    firstName: 'Jay',
    slackToken: 'xoxc-mock-picnic-runner',
    autoReact: true,
    autoPicnicReact: true
  });
  await db.syncScheduledShifts(runnerId, parsedPreSplit);

  const resOn = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'MIDDAG',
      date: testDateNl,
      isSimulation: true
    })
  });
  assert.equal(resOn.status, 200);
  const dataOn = await resOn.json();
  const runnerResOn = dataOn.emulation.result.runners.find((r) => r.userId === runnerId);
  assert.ok(runnerResOn);
  assert.equal(runnerResOn.picnicReacted, true, 'Must automatically react with :picnic: when autoPicnicReact is true');
  assert.equal(runnerResOn.picnicEmoji, 'picnic');
  assert.deepEqual(runnerResOn.picnicBlocks, ['S1', 'S2', 'S3']);

  // 3. Test that disabling autoPicnicReact turns off :picnic: reaction
  db.saveUser(runnerId, { autoPicnicReact: false });
  const resOff = await fetch(`${baseUrl}/api/test/emulate-planner`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey
    },
    body: JSON.stringify({
      period: 'MIDDAG',
      date: testDateNl,
      isSimulation: true
    })
  });
  const dataOff = await resOff.json();
  const runnerResOff = dataOff.emulation.result.runners.find((r) => r.userId === runnerId);
  assert.equal(runnerResOff.picnicReacted, false, 'Must NOT react with :picnic: when autoPicnicReact is false');

  db.deleteUser(runnerId);
});
