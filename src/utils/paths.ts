/**
 * Utility functions for generating static paths from file system
 */
import fs from "fs";
import fsAsync from "fs/promises";
import path from "path";

interface StaticPathParams {
  subject: string;
  page?: string;
}

interface StaticPath {
  params: StaticPathParams;
}

export async function pathExists(target: string): Promise<boolean> {
  try {
    const stats = await fsAsync.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

/**
 * Get all valid subjects from the files directory
 */
export function getValidSubjects(): string[] {
  const filesPath = path.join(process.cwd(), import.meta.env.FILES_DIR || "files");
  return fs
    .readdirSync(filesPath)
    .filter((file) => fs.statSync(path.join(filesPath, file)).isDirectory());
}

/**
 * Get valid pages for a given subject
 */
export function getValidPages(subject: string): string[] {
  const filesPath = path.join(process.cwd(), import.meta.env.FILES_DIR || "files");
  const subjectPath = subject === "admitere" 
    ? path.join(filesPath, subject)
    : path.join(filesPath, `${subject}/pages`);

  if (!fs.existsSync(subjectPath)) {
    return [];
  }

  return fs
    .readdirSync(subjectPath)
    .filter(file => 
      fs.statSync(path.join(subjectPath, file)).isDirectory()
    );
}

/**
 * Get the first/primary page for a given subject
 */
export function getFirstPage(subject: string): string {
  const pages = getValidPages(subject);
  return pages.length > 0 ? pages[0] : "bac";
}

/**
 * Generate static paths for subject index pages
 */
export function generateSubjectIndexPaths(excludedSubjects: string[] = []): StaticPath[] {
  return getValidSubjects()
    .filter(subject => !excludedSubjects.includes(subject))
    .filter(subject => getValidPages(subject).includes("bac"))
    .map(subject => ({ params: { subject } }));
}

/**
 * Generate static paths for subject/page combinations
 */
export function generateSubjectPagePaths(): StaticPath[] {
  const paths: StaticPath[] = [];
  
  getValidSubjects().forEach(subject => {
    getValidPages(subject).forEach(page => {
      if (page !== "bac") {
        paths.push({ params: { subject, page } });
      }
    });
  });
  
  return paths;
}
