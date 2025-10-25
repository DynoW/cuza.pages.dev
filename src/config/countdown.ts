// Configuration for CountdownTimer component
export const countdownConfig = {
  // Simulare admitere dates
  simulare_admitere: {
    title: "Simulare Admitere UPB 2026",
    startDate: "March 15, 2026 10:00:00",
    endDate: "March 15, 2026 13:00:00",
  },

  // Simulare BAC dates
  simulare_bac: {
    title: "Simulare BAC 2026",
    startDate: "March 23, 2026 09:00:00",
    endDate: "March 25, 2026 12:00:00",
  },

  // Admitere dates
  preadmitere: {
    title: "Preadmitere UPB 2026",
    startDate: "April 6, 2026 10:00:00",
    endDate: "April 6, 2026 13:00:00",
  },

  // BAC dates
  bac_1: {
    title: "BAC iunie-iulie 2026",
    startDate: "June 29, 2026 09:00:00",
    endDate: "July 2, 2026 12:00:00",
  },
  
  // Admitere dates
  admitere: {
    title: "Admitere UPB 2026",
    startDate: "July 14, 2026 10:00:00",
    endDate: "July 14, 2026 13:00:00",
  },

  // BAC dates
  bac_2: {
    title: "BAC august 2026",
    startDate: "August 10, 2026 09:00:00",
    endDate: "August 12, 2026 12:00:00",
  },
} as const;

const currentExam = 'simulare_admitere';

// Default config type
export type ExamType = keyof typeof countdownConfig;

// Helper function to get config by exam type
export function getCountdownConfig(examType: ExamType = currentExam) {
  return countdownConfig[examType];
}
