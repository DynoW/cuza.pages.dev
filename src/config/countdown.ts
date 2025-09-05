// Configuration for CountdownTimer component
export const countdownConfig = {
  // BAC dates
  bac: {
    title: "BAC 2025",
    startDate: "June 10, 2025 09:00:00",
    endDate: "June 13, 2025 12:00:00",
  },
  
  // Admitere dates
  admitere: {
    title: "Admitere 2025",
    startDate: "July 1, 2025 09:00:00",
    endDate: "July 15, 2025 18:00:00",
  },
  
  // Simulare BAC dates
  simulare_bac: {
    title: "Simulare BAC 2026",
    startDate: "March 15, 2026 09:00:00",
    endDate: "March 20, 2026 12:00:00",
  },

  // Simulare BAC dates
  simulare_admitere: {
    title: "Simulare Admitere 2025",
    startDate: "March 15, 2025 09:00:00",
    endDate: "March 20, 2025 12:00:00",
  },
} as const;

const currentExam = 'simulare_bac';

// Default config type
export type ExamType = keyof typeof countdownConfig;

// Helper function to get config by exam type
export function getCountdownConfig(examType: ExamType = currentExam) {
  return countdownConfig[examType];
}
