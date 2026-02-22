import { apiService } from './api';

interface StaticPathParams {
  subject: string;
  page?: string;
}

interface StaticPath {
  params: StaticPathParams;
  props?: Record<string, unknown>;
}

/** Generates static paths for subject index pages (e.g. `/fizica`), optionally excluding specific subjects. */
export async function subjectIndexPaths(excludedSubjects: string[] = []): Promise<StaticPath[]> {
  const subjectPages = await apiService.getStructure();
  return Object.entries(subjectPages)
    .filter(([subject]) => !excludedSubjects.includes(subject))
    .map(([subject, pages]) => ({
      params: { subject },
      props: { firstPage: pages[0] ?? 'bac' },
    }));
}

/** Generates static paths for all subject sub-pages (e.g. `/fizica/simulari-judetene`), excluding `bac` since that is handled by the index page. */
export async function subjectPagePaths(): Promise<StaticPath[]> {
  const subjectPages = await apiService.getStructure();
  const paths: StaticPath[] = [];
  for (const [subject, pages] of Object.entries(subjectPages)) {
    for (const page of pages) {
      if (page !== 'bac') {
        paths.push({ params: { subject, page } });
      }
    }
  }
  return paths;
}
