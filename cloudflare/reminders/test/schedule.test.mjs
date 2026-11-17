import assert from 'node:assert/strict';
import test from 'node:test';
import { planReminders } from '../src/schedule.mjs';

const picks = (rules, utc, sent = {}, activeFrom = 0) =>
  planReminders({ schedules: rules, timeZone: 'Europe/Paris', activeFrom }, Date.parse(utc), sent)
    .due.map(({ kind, date }) => ({ kind, date }));
const rule = (time, frequency = 'daily', day = 0) => ({ enabled: true, frequency, day, time });

test('two meals due at the same local minute keep distinct occurrences', () => {
  assert.deepEqual(picks({ lunch: rule('12:30'), 'snack-pm': rule('12:30') }, '2026-11-15T11:30:00Z'), [
    { kind: 'lunch', date: '2026-11-15' }, { kind: 'snack-pm', date: '2026-11-15' },
  ]);
});

test('a reminder repeats only on its configured weekday', () => {
  assert.deepEqual(picks({ weight: rule('07:30', 'weekly', 1) }, '2026-11-15T06:30:00Z'), []);
  assert.deepEqual(picks({ weight: rule('07:30', 'weekly', 1) }, '2026-11-16T06:30:00Z'), [
    { kind: 'weight', date: '2026-11-16' },
  ]);
});

test('a monthly 31st rolls to the last day of a shorter month', () => {
  assert.deepEqual(picks({ measure: rule('08:00', 'monthly', 31) }, '2026-02-27T07:00:00Z'), []);
  assert.deepEqual(picks({ measure: rule('08:00', 'monthly', 31) }, '2026-02-28T07:00:00Z'), [
    { kind: 'measure', date: '2026-02-28' },
  ]);
});

test('the spring clock jump delivers a skipped local reminder at 03:00', () => {
  assert.deepEqual(picks({ weight: rule('02:30') }, '2026-03-29T01:00:00Z'), [
    { kind: 'weight', date: '2026-03-29' },
  ]);
});

test('the autumn clock change cannot repeat an accepted occurrence', () => {
  assert.deepEqual(picks({ weight: rule('02:30') }, '2026-10-25T00:30:00Z'), [
    { kind: 'weight', date: '2026-10-25' },
  ]);
  assert.deepEqual(picks({ weight: rule('02:30') }, '2026-10-25T01:30:00Z', { weight: { '2026-10-25': ['02:30'] } }), []);
});

test('a one-off reminder uses the chosen local date on both sides of UTC midnight', () => {
  const schedules = { weight: { ...rule('00:01', 'once'), date: '2026-11-18' } };
  assert.deepEqual(picks(schedules, '2026-11-16T23:01:00Z'), []);
  assert.deepEqual(picks(schedules, '2026-11-17T23:01:00Z'), [{ kind: 'weight', date: '2026-11-18' }]);
  assert.deepEqual(picks(schedules, '2026-11-18T23:01:00Z'), []);
});

test('a short interruption can retry an occurrence, without replaying pre-enrollment times', () => {
  const rules = { dinner: rule('20:00') };
  assert.deepEqual(picks(rules, '2026-11-15T19:04:00Z'), [{ kind: 'dinner', date: '2026-11-15' }]);
  assert.deepEqual(picks(rules, '2026-11-15T19:05:00Z'), []);
  assert.deepEqual(picks(rules, '2026-11-15T19:04:00Z', {}, Date.parse('2026-11-15T19:01:00Z')), []);
});
