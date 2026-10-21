import assert from 'node:assert/strict';
import { test } from 'node:test';
import { qrDirection, shouldAnnounceQR, trackQR } from '../src/qrGuidance.ts';
import { selectSpeechService, speechErrorMessage, stopSpeechForInput, withSpeechDeadline } from '../src/voiceService.ts';

const view = { width: 300, height: 400 };
const box = (x: number, y: number) => ({ origin: { x, y }, size: { width: 40, height: 40 } });
test('QR speech suppresses repeated directions and rapid direction changes', () => {
  assert.equal(shouldAnnounceQR({ direction: '', time: 0 }, 'left', 100), true);
  const previous = { direction: 'left', time: 1000 };
  assert.equal(shouldAnnounceQR(previous, 'left', 10000), false);
  assert.equal(shouldAnnounceQR(previous, 'right', 2000), false);
  assert.equal(shouldAnnounceQR(previous, 'right', 3500), true);
});
test('QR guidance uses preview coordinates for each axis and center', () => {
  for (const [x, y, direction] of [[10, 180, 'left'], [250, 180, 'right'], [130, 10, 'up'], [130, 350, 'down'], [130, 180, 'center']] as const) {
    assert.equal(qrDirection(box(x, y), [], view), direction);
  }
  // Corner order differs across Android and iOS; it must not change direction.
  const corners = [{ x: 10, y: 180 }, { x: 50, y: 180 }, { x: 50, y: 220 }, { x: 10, y: 220 }];
  assert.equal(qrDirection(box(130, 180), corners.reverse(), view), 'left');
  assert.equal(qrDirection(box(NaN, 0), [], view), 'unknown');
  assert.equal(qrDirection(box(0, 0), [], { width: 0, height: 0 }), 'unknown');
  assert.equal(qrDirection({ origin: { x: 0, y: 0 }, size: { width: 0, height: 0 } }, [], view), 'unknown');
});
test('QR acceptance needs sustained centering of the same visible code', () => {
  let { track } = trackQR(null, 'upi-A', 'center', 0);
  assert.equal(trackQR(track, 'upi-A', 'center', 500).accept, false);
  track = trackQR(track, 'upi-A', 'center', 500).track;
  assert.equal(trackQR(track, 'upi-A', 'center', 1000).accept, true);
  assert.equal(trackQR(track, 'upi-B', 'center', 1000).accept, false);
  assert.equal(trackQR(track, 'upi-A', 'left', 1000).accept, false);
  assert.equal(trackQR(track, 'upi-A', 'center', 3000).accept, false);
  assert.equal(trackQR(null, 'upi-A', 'unknown', 3000).accept, false);
});
test('recognition discovers current Google service while preserving device default', () => {
  assert.equal(selectSpeechService(['com.google.android.tts'], ''), 'com.google.android.tts');
  assert.equal(selectSpeechService(['com.google.android.googlequicksearchbox'], 'disabled.service'), 'com.google.android.googlequicksearchbox');
  assert.equal(selectSpeechService(['vendor.service', 'com.google.android.tts'], 'vendor.service'), 'vendor.service');
  assert.equal(selectSpeechService([], ''), undefined);
  assert.match(speechErrorMessage('audio-capture'), /microphone/);
  assert.match(speechErrorMessage('service-not-allowed'), /Google/);
});
test('a stalled native speech operation fails safely instead of starting a competing microphone', async () => {
  await assert.rejects(withSpeechDeadline(new Promise(() => {}), 10), /Stop speaking/);
  assert.equal(await withSpeechDeadline(Promise.resolve('stopped')), 'stopped');
  await assert.rejects(withSpeechDeadline(Promise.reject(new Error('TTS unavailable'))), /TTS unavailable/);
});

test('microphone handoff verifies quiet even if Android stop promise does not settle', async () => {
  let checks = 0;
  await stopSpeechForInput(() => new Promise(() => {}), async () => ++checks < 3, 100, 1);
  assert.equal(checks, 4);
  await assert.rejects(stopSpeechForInput(async () => {}, async () => true, 10, 1), /still active/);
  await assert.rejects(stopSpeechForInput(async () => {}, () => new Promise(() => {}), 10, 1), /Stop speaking/);
});
