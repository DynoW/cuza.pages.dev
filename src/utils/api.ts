/**
 * API service for handling data fetching and error management
 */
import { promises as fs, Dirent } from 'node:fs';
import path from 'node:path';

import { extractYearsFromStructure } from './data';

export interface FileStructure {
  [key: string]: FileStructure | string;
}

export interface ApiResponse {
  content?: FileStructure;
  years?: number[];
}

export type BucketMode = 'off' | 'local' | 'remote';

const FALLBACK_URL = 'http://localhost:8787';
const FILES_ROOT = path.join(process.cwd(), 'files');

function ensureValidBucketMode(mode: string | undefined): BucketMode {
  if (mode === 'off' || mode === 'local' || mode === 'remote') {
    return mode;
  }
  return 'remote';
}

const normalizeBaseUrl = (value?: string): string => value ? value.replace(/\/$/, '') : '';

export function getBucketMode(): BucketMode {
  return ensureValidBucketMode(import.meta.env.PUBLIC_BUCKET_MODE);
}

export function resolveWorkerBaseUrl(mode: BucketMode = getBucketMode()): string {
  if (mode === 'off') {
    return '';
  }

  if (mode === 'local') {
    return normalizeBaseUrl(import.meta.env.LOCAL_WORKER_URL) || FALLBACK_URL;
  }

  return normalizeBaseUrl(import.meta.env.WORKER_URL) || FALLBACK_URL;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    const stats = await fs.stat(target);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

function resolveLocalTarget(subject: string, page: string): { directory: string; prefix: string } {
  const subjectLower = subject.toLowerCase();
  const pageLower = page.toLowerCase();

  if (subjectLower === 'admitere') {
    if (pageLower.includes('/extra')) {
      const subsubject = pageLower.replace('/extra', '');
      return {
        directory: path.join(FILES_ROOT, 'admitere', subsubject, 'extra'),
        prefix: path.posix.join('files', 'admitere', subsubject, 'extra')
      };
    }

    return {
      directory: path.join(FILES_ROOT, 'admitere', pageLower, 'admitere'),
      prefix: path.posix.join('files', 'admitere', pageLower, 'admitere')
    };
  }

  if (pageLower === 'extra') {
    return {
      directory: path.join(FILES_ROOT, subjectLower, 'extra'),
      prefix: path.posix.join('files', subjectLower, 'extra')
    };
  }

  return {
    directory: path.join(FILES_ROOT, subjectLower, 'pages', pageLower),
    prefix: path.posix.join('files', subjectLower, 'pages', pageLower)
  };
}

async function buildLocalStructure(directory: string, prefix: string): Promise<FileStructure> {
  let entries: Dirent[];

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch (error) {
    console.warn('Failed to read local directory:', directory, error);
    return {};
  }

  entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

  const structure: FileStructure = {};

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const lowerName = entry.name.toLowerCase();
    if (lowerName.includes('ignore')) {
      continue;
    }

    if (entry.isDirectory()) {
      structure[entry.name] = await buildLocalStructure(
        path.join(directory, entry.name),
        path.posix.join(prefix, entry.name)
      );
    } else if (entry.isFile()) {
      structure[entry.name] = path.posix.join(prefix, entry.name);
    }
  }

  return structure;
}

async function getLocalFileStructure(subject: string, page: string): Promise<FileStructure> {
  const { directory, prefix } = resolveLocalTarget(subject, page);
  if (!(await pathExists(directory))) {
    return {};
  }

  return buildLocalStructure(directory, prefix);
}

async function getLocalYears(subject: string, page: string): Promise<number[]> {
  const content = await getLocalFileStructure(subject, page);
  if (!content) {
    return [];
  }

  return extractYearsFromStructure(content);
}

async function searchLocalFiles(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const loweredQuery = trimmed.toLowerCase();
  const results: string[] = [];

  if (!(await pathExists(FILES_ROOT))) {
    return results;
  }

  async function walk(directory: string, prefix: string): Promise<void> {
  let entries: Dirent[];

    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        continue;
      }

      const lowerName = entry.name.toLowerCase();
      if (lowerName.includes('ignore')) {
        continue;
      }

      const nextPrefix = path.posix.join(prefix, entry.name);

      if (entry.isDirectory()) {
        await walk(path.join(directory, entry.name), nextPrefix);
      } else if (entry.isFile()) {
        if (nextPrefix.toLowerCase().includes(loweredQuery)) {
          results.push(nextPrefix);
        }
      }
    }
  }

  await walk(FILES_ROOT, 'files');
  return results;
}

export class ApiService {
  private readonly baseUrl: string;
  private readonly mode: BucketMode;

  constructor(baseUrl?: string, mode?: BucketMode) {
    this.mode = mode ?? getBucketMode();
    this.baseUrl = baseUrl ?? resolveWorkerBaseUrl(this.mode);
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn('API fetch failed:', error);
      return null;
    }
  }

  async getContent(subject: string, page: string): Promise<FileStructure | null> {
    if (this.mode === 'off') {
      return getLocalFileStructure(subject, page);
    }

    const url = `${this.baseUrl}/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}`;
    const response = await this.fetchJson<ApiResponse>(url);
    console.log('Fetched content:', response);
    return response?.content || null;
  }

  async getYears(subject: string, page: string): Promise<number[]> {
    if (this.mode === 'off') {
      return getLocalYears(subject, page);
    }

    const url = `${this.baseUrl}/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}&years=true`;
    const response = await this.fetchJson<{ years: number[] }>(url);
    return response?.years || [];
  }

  async searchFiles(query: string): Promise<string[]> {
    if (this.mode === 'off') {
      return searchLocalFiles(query);
    }

    const url = `${this.baseUrl}/files?q=${encodeURIComponent(query)}`;
    const response = await this.fetchJson<{ files: string[] }>(url);
    return response?.files || [];
  }
}

// Singleton instance
export const apiService = new ApiService();
