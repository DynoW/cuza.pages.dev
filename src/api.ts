import type { PageData } from './types';

export class ApiService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl ?? import.meta.env.PUBLIC_WORKER_URL;
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

  async getYears(subject: string, page: string): Promise<number[]> {
    const url = `${this.baseUrl}/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}&years=true`;
    const response = await this.fetchJson<{ years: number[] }>(url);
    return response?.years || [];
  }

  async getPageData(subject: string, page: string): Promise<PageData> {
    const url = `${this.baseUrl}/page-data?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}`;
    const response = await this.fetchJson<PageData>(url);
    return response ?? { content: {}, extra: {}, years: [] };
  }

  private structureCache: Record<string, string[]> | null = null;

  async getStructure(): Promise<Record<string, string[]>> {
    if (this.structureCache) return this.structureCache;
    const url = `${this.baseUrl}/structure`;
    const response = await this.fetchJson<Record<string, string[]>>(url);
    this.structureCache = response ?? {};
    return this.structureCache;
  }

//   async searchFiles(query: string): Promise<string[]> {
//     const url = `${this.baseUrl}/files?q=${encodeURIComponent(query)}`;
//     const response = await this.fetchJson<{ files: string[] }>(url);
//     return response?.files || [];
//   }
}

export const apiService = new ApiService();
