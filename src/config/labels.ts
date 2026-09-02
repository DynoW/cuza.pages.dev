export const SUBJECT_DISPLAY_NAMES: Record<string, string> = {
  admitere: 'Admitere',
  anat: 'Anatomie',
  bio: 'Biologie',
  chimie: 'Chimie',
  economie: 'Economie',
  filosofie: 'Filosofie',
  fizica: 'Fizică',
  geo: 'Geografie',
  info: 'Informatică',
  istorie: 'Istorie',
  logica: 'Logică',
  mate: 'Matematică',
  psihologie: 'Psihologie',
  romana: 'Română',
  sociologie: 'Sociologie',
};

export const PAGE_DISPLAY_NAMES: Record<string, string> = {
  bac: 'BAC',
  fizica: 'Fizică',
  info: 'Informatică',
  mate: 'Matematică',
  'mate-info-c': 'Mate-Info (C)',
  'mate-info-pascal': 'Mate-Info (Pascal)',
  'st-nat-c': 'Științe ale Naturii (C)',
  'st-nat-pascal': 'Științe ale Naturii (Pascal)',
  'st-nat' : 'Științe ale Naturii',
};

export const FOLDER_DISPLAY_NAMES: Record<string, string> = {
  sesiunea_1: 'Sesiunea I',
  sesiunea_2: 'Sesiunea a II-a',
  sesiunea_1_rezerva: 'Sesiunea I — Rezervă',
  sesiunea_2_rezerva: 'Sesiunea a II-a — Rezervă',
  simulare_judetene: 'Simulări Județene',
  modele: 'Modele',
  teste_de_antrenament: 'Teste de Antrenament',
  bac: 'BAC',
  diverse: 'Diverse',
};

export function getFolderDisplayName(key: string): string {
  return FOLDER_DISPLAY_NAMES[key] ?? formatSlugLabel(key);
}

export function formatSlugLabel(value: string): string {
  const normalized = value.replace(/-/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function getDisplayName(value: string): string {
  return (
    SUBJECT_DISPLAY_NAMES[value] ??
    PAGE_DISPLAY_NAMES[value] ??
    formatSlugLabel(value)
  );
}

const FOLDER_PRIORITY_RULES: Array<[RegExp, number]> = [
  [/\badmitere\b/, 0],
  [/\bpreadmitere\b/, 1],
  [/\bsesiunea\s*(ii|2)\s*rezerva\b/, 2],
  [/\bsesiunea\s*(ii|2)\b/, 3],
  [/\bsesiunea\s*(i|1)\s*rezerva\b/, 4],
  [/\bsesiunea\s*(i|1)\b/, 5],
  [/(special|olimp)/, 6],
  [/\bbac\b/, 7],
  [/\bsimulare xii\b/, 8],
  [/\bsimulare xi\b/, 9],
  [/\bsimulare\b/, 10],
  [/\bmodel\b/, 11],
  [/\bsimulari judetene\b/, 12],
  [/\bteste de antrenament\b/, 13],
  [/\b100 variante\b/, 14],
  [/\b-\b/, 15],
];

export function getFolderPriority(key: string): number {
  const normalized = key.toLowerCase().replace(/[-_]+/g, ' ');

  for (const [pattern, priority] of FOLDER_PRIORITY_RULES) {
    if (pattern.test(normalized)) return priority;
  }

  return 100;
}

function extractProfile(key: string): string | null {
  const m = key.match(/_([A-Za-z0-9]{2,4})_(20\d{2})_/);
  return m ? m[1] : null;
}

export function formatFileName(key: string): string {
  const fizicaMatch = key.match(
    /^E_d_fizica_([A-Za-z\u00C0-\u024F]+)_(\d{4})(?:_(\d+))?_(var|bar)\.pdf$/i,
  );
  if (fizicaMatch) {
    const location = fizicaMatch[1];
    const num = fizicaMatch[3];
    const isVar = fizicaMatch[4].toLowerCase() === 'var';
    const type = isVar ? 'Varianta' : 'Barem';
    const prefix = num ? `${location} ${num}` : location;
    return `${prefix} - ${type}`;
  }

  const hMatch = key.match(
    /^(H_Hulubei_regionala(?:_[A-Za-z]+)*)_(\d{4})_(var|bar)\.pdf$/i,
  );
  if (hMatch) {
    const name = hMatch[1].replace(/_/g, ' ');
    const isVar = hMatch[3].toLowerCase() === 'var';
    return `${name} - ${isVar ? 'Varianta' : 'Barem'}`;
  }

  const testMatch = key.match(/_(Test)_(\d{2})\.pdf$/i);
  if (testMatch) {
    return `Test ${testMatch[2]}`;
  }

  const match = key.match(/_(var|bar)(?:_([a-z0-9]+))?(?:_rasp)?\.pdf$/i);
  if (match) {
    const isVar = match[1].toLowerCase() === 'var';
    const hasRasp = key.includes('_rasp');
    const type = hasRasp || !isVar ? 'Barem' : 'Varianta';
    const suffix = match[2];
    const showSuffix = suffix && !/^(model|simulare)$/i.test(suffix);
    const profile = /^E_d_anat|^E_d_bio/i.test(key)
      ? null
      : extractProfile(key);
    const display = showSuffix ? `${type} ${suffix}` : type;
    return profile ? `${profile} ${display}` : display;
  }

  if (/_(?:rasp)\.pdf$/i.test(key)) {
    return 'Barem';
  }

  return key;
}
