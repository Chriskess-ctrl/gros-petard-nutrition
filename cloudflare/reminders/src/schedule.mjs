const MINUTE = 60_000;
export const RETRY_MINUTES = 5;
export const REMINDER_MESSAGES = Object.freeze({
  weight: 'Pense à noter ta pesée.',
  measure: 'Pense à noter tes mensurations.',
  breakfast: 'Pense à noter ton petit-déjeuner.',
  'snack-am': 'Pense à noter ta collation du matin.',
  lunch: 'Pense à noter ton déjeuner.',
  'snack-pm': 'Pense à noter ta collation de l’après-midi.',
  dinner: 'Pense à noter ton dîner.',
});

function localMinute(formatter, timestamp) {
  const parts = Object.fromEntries(formatter.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day,
    weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay(),
    lastDay: new Date(Date.UTC(year, month, 0)).getUTCDate(),
    minute: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export function planReminders({ schedules, timeZone, activeFrom, activeFromByKind = {} }, scheduledTime, sentOccurrences) {
  const plan = { due: [], alreadySent: 0, beforeActivation: 0 };
  const enabled = Object.entries(schedules).filter(([, rule]) => rule.enabled).map(([kind, rule]) => {
    const [hour, minute] = rule.time.split(':').map(Number);
    return { kind, rule, target: hour * 60 + minute };
  });
  if (!enabled.length) return plan;

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const now = Math.floor(scheduledTime / MINUTE) * MINUTE;
  const first = now - (RETRY_MINUTES - 1) * MINUTE;
  const occurrences = new Map();
  let previous = localMinute(formatter, first - MINUTE);

  for (let tick = first; tick <= now; tick += MINUTE) {
    const current = localMinute(formatter, tick);
    // A clock jump within the day makes skipped local times due at the first valid minute.
    const after = current.date === previous.date && current.minute > previous.minute
      ? previous.minute : current.minute - 1;
    previous = current;
    for (const { kind, rule, target } of enabled) {
      if (target <= after || target > current.minute) continue;
      if (rule.frequency === 'once' && rule.date !== current.date) continue;
      if (rule.frequency === 'weekly' && rule.day !== current.weekday) continue;
      if (rule.frequency === 'monthly' && current.day !== Math.min(rule.day, current.lastDay)) continue;
      occurrences.set(`${kind}/${current.date}`, { kind, date: current.date, time: rule.time, tick });
    }
  }

  for (const { kind, date, time, tick } of occurrences.values()) {
    if (sentOccurrences[kind]?.[date]?.includes(time)) {
      plan.alreadySent += 1;
    } else if (tick + MINUTE <= (activeFromByKind[kind] ?? activeFrom)) {
      // A change during the target minute can still send on the next tick.
      plan.beforeActivation += 1;
    } else {
      plan.due.push({ kind, date, time });
    }
  }
  return plan;
}
