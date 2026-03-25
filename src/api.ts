import type { PageData } from "./types";

const DEFAULT_WORKER_URL = "https://api.my-lab.ro";

export class ApiService {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl =
      (baseUrl ?? import.meta.env.PUBLIC_WORKER_URL) || DEFAULT_WORKER_URL;
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`API responded with status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.warn("API fetch failed:", error);
      return null;
    }
  }

  async getPageData(subject: string, page: string): Promise<PageData> {
    const url = `${this.baseUrl}/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}`;
    const response = await this.fetchJson<PageData>(url);
    if (!response) {
      return { content: {}, extra: {}, years: [] };
    }

    const content =
      response.content && typeof response.content === "object"
        ? response.content
        : {};
    const extra =
      response.extra && typeof response.extra === "object"
        ? response.extra
        : {};
    const years = Array.isArray(response.years) ? response.years : [];

    return { content, extra, years };
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
