import { getDisplayName } from './labels';

export interface PageMeta {
  title: string;
  heading: string;
  description: string;
  ogImage: string;
  canonicalUrl: string;
}

interface PageContext {
  isHome: boolean;
  isBac: boolean;
  isAdmitere: boolean;
  subjectLabel: string;
  pageLabel: string;
  canonicalUrl: string;
  ogImage: string;
}

function getPageContext(subject: string, page: string): PageContext {
  const isHome = subject === 'fizica' && page === 'teoretic';
  const isBac = page === 'bac';
  const isAdmitere = subject === 'admitere';
  const subjectLabel =
    subject === 'admitere' ? 'Admitere UPB' : getDisplayName(subject);
  const pageLabel = getDisplayName(page);
  const canonicalUrl = isHome
    ? 'https://cuza.pages.dev'
    : `https://cuza.pages.dev/${subject}/${page}`;
  const ogImage = isHome
    ? 'https://cuza.pages.dev/open-graph/index.png'
    : `https://cuza.pages.dev/open-graph/${subject}/${page}.png`;

  return {
    isHome,
    isBac,
    isAdmitere,
    subjectLabel,
    pageLabel,
    canonicalUrl,
    ogImage,
  };
}

export function getPageMeta(subject: string, page: string): PageMeta {
  const {
    isHome,
    isBac,
    isAdmitere,
    subjectLabel,
    pageLabel,
    canonicalUrl,
    ogImage,
  } = getPageContext(subject, page);

  let title: string;
  let heading: string;
  let description: string;

  if (isHome) {
    title = 'Fizică – Variante și bareme';
    heading = 'Fizică Teoretic';
    description =
      'Arhivă cu subiecte, simulări județene și bareme de bacalaureat la Fizică. Descarcă gratuit materialele de pregătire.';
  } else if (isAdmitere) {
    title = `Admitere UPB ${pageLabel} – Subiecte și rezolvări`;
    heading = `Admitere UPB – ${pageLabel}`;
    description = `Subiecte și bareme de admitere UPB la ${pageLabel}. Descarcă gratuit materialele de pregătire pentru Politehnică.`;
  } else if (isBac) {
    title = `${subjectLabel} BAC – Subiecte și bareme`;
    heading = `${subjectLabel}`;
    description = `Variante oficiale din toate sesiunile de BAC la ${subjectLabel}. Descarcă gratuit materialele de pregătire.`;
  } else {
    title = `${subjectLabel} ${pageLabel} – Subiecte și bareme`;
    heading = `${subjectLabel} ${pageLabel}`;
    description = `Subiecte oficiale și bareme pentru ${subjectLabel} ${pageLabel}. Descarcă gratuit materialele de pregătire.`;
  }

  return { title, heading, description, ogImage, canonicalUrl };
}

export function getPageTitle(title: string): string {
  return `${title} | CuzaPages`;
}

export function getCollectionJsonLd(
  subject: string,
  page: string,
): Record<string, unknown> | null {
  if (!subject || !page) return null;
  const { isBac, isAdmitere } = getPageContext(subject, page);
  const meta = getPageMeta(subject, page);

  let about: Record<string, string>;
  if (isBac) {
    about = { '@type': 'Thing', name: 'Bacalaureat' };
  } else if (isAdmitere) {
    about = { '@type': 'Thing', name: 'Admitere UPB' };
  } else {
    about = {
      '@type': 'Thing',
      name: getPageContext(subject, page).subjectLabel,
    };
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Collection',
    '@id': 'https://cuza.pages.dev/#collection',
    name: meta.title,
    description: meta.description,
    about,
  };
}

export function getBreadcrumbs(
  subject: string,
  page: string,
): Array<{ name: string; url?: string }> {
  const { isHome, subjectLabel, pageLabel } = getPageContext(subject, page);
  const HOME_CRUMB = { name: 'Acasă', url: 'https://cuza.pages.dev' };

  if (isHome) return [HOME_CRUMB];

  const crumbName =
    page === 'BAC' ? subjectLabel : `${subjectLabel} - ${pageLabel}`;

  return [
    HOME_CRUMB,
    { name: crumbName, url: `https://cuza.pages.dev/${subject}/${page}` },
  ];
}
