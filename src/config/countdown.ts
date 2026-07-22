// Configuration for CountdownTimer component
export const countdownConfig = {
  // Simulare admitere dates
  simulare_admitere: {
    title: 'Simulare Admitere UPB 2026',
    startDate: 'March 7, 2026 10:00:00',
    endDate: 'March 7, 2026 13:00:00',
  },

  // Simulare BAC dates
  simulare_bac: {
    title: 'Simulare BAC 2026',
    startDate: 'March 23, 2026 09:00:00',
    endDate: 'March 25, 2026 12:00:00',
  },

  // Admitere dates
  preadmitere: {
    title: 'Preadmitere UPB 2026',
    startDate: 'March 28, 2026 10:00:00',
    endDate: 'March 28, 2026 13:00:00',
  },

  // BAC dates
  bac_1: {
    title: 'BAC iunie-iulie 2026',
    startDate: 'June 29, 2026 09:00:00',
    endDate: 'July 2, 2026 12:00:00',
  },

  // Admitere dates
  admitere: {
    title: 'Admitere UPB 2026',
    startDate: 'July 14, 2026 10:00:00',
    endDate: 'July 14, 2026 13:00:00',
  },

  // BAC dates
  bac_2: {
    title: 'BAC august 2026',
    startDate: 'August 10, 2026 09:00:00',
    endDate: 'August 12, 2026 12:00:00',
  },
} as const;

export type ExamType = keyof typeof countdownConfig;

export function getCountdownConfig() {
  const now = Date.now();
  const entries = (Object.keys(countdownConfig) as ExamType[])
    .map((key) => ({ key, ...countdownConfig[key] }))
    .map((e) => ({
      ...e,
      startTime: new Date(e.startDate).getTime(),
      endTime: new Date(e.endDate).getTime(),
    }));

  const inProgress = entries.find(
    (e) => now >= e.startTime && now <= e.endTime,
  );
  if (inProgress) return countdownConfig[inProgress.key];

  const upcoming = entries
    .filter((e) => e.startTime > now)
    .sort((a, b) => a.startTime - b.startTime);
  if (upcoming.length > 0) return countdownConfig[upcoming[0].key];

  const last = entries.sort((a, b) => a.endTime - b.endTime).pop();
  return last;
}

export function getForcedCountdownConfig() {
  return countdownConfig['bac_1'];
}
