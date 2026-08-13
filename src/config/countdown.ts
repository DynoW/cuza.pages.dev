// Configuration for CountdownTimer component
export const countdownConfig = {
  simulare_admitere: {
    title: 'Simulare Admitere UPB 2027',
    startDate: 'March 6, 2027 10:00:00',
    endDate: 'March 6, 2027 13:00:00',
  },

  simulare_bac: {
    title: 'Simulare BAC 2027',
    startDate: 'March 22, 2027 09:00:00',
    endDate: 'March 24, 2027 12:00:00',
  },

  preadmitere: {
    title: 'Preadmitere UPB 2027',
    startDate: 'March 27, 2027 10:00:00',
    endDate: 'March 27, 2027 13:00:00',
  },

  bac_1: {
    title: 'BAC iunie-iulie 2027',
    startDate: 'June 28, 2027 09:00:00',
    endDate: 'June 30, 2027 12:00:00',
  },

  admitere: {
    title: 'Admitere UPB 2027',
    startDate: 'July 13, 2027 10:00:00',
    endDate: 'July 13, 2027 13:00:00',
  },

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
  return last ? countdownConfig[last.key] : undefined;
}

export function getForcedCountdownConfig() {
  return countdownConfig['bac_1'];
}
