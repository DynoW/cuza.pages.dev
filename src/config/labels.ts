export const SUBJECT_DISPLAY_NAMES: Record<string, string> = {
  admitere: "Admitere",
  anat: "Anatomie",
  bio: "Biologie",
  chimie: "Chimie",
  economie: "Economie",
  filosofie: "Filosofie",
  fizica: "Fizică",
  geo: "Geografie",
  info: "Informatică",
  istorie: "Istorie",
  logica: "Logică",
  mate: "Matematică",
  psihologie: "Psihologie",
  romana: "Română",
  sociologie: "Sociologie",
};

export const PAGE_DISPLAY_NAMES: Record<string, string> = {
  bac: "BAC",
  fizica: "Fizică",
  info: "Informatică",
  mate: "Matematică",
  "simulari-judetene": "Simulări județene/locale",
  "mate-info-C": "Mate-Info (C)",
  "mate-info-Pascal": "Mate-Info (Pascal)",
  "st-nat-C": "Științe Ale Naturii (C)",
  "st-nat-Pascal": "Științe Ale Naturii (Pascal)",
};

export function formatSlugLabel(value: string): string {
  const normalized = value.replace(/-/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getDisplayName(value: string): string {
  return (
    SUBJECT_DISPLAY_NAMES[value] ??
    PAGE_DISPLAY_NAMES[value] ??
    formatSlugLabel(value)
  );
}
