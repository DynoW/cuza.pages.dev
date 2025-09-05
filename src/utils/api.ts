/**
 * API service for handling data fetching and error management
 */

export interface FileStructure {
  [key: string]: FileStructure | string;
}

export interface ApiResponse {
  content?: FileStructure;
  years?: number[];
}

export class ApiService {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.WORKER_URL || "http://localhost:8787";
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
    const url = `${this.baseUrl}/api/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}`;
    const response = await this.fetchJson<ApiResponse>(url);
    return response?.content || null;
  }

  async getYears(subject: string, page: string): Promise<number[]> {
    const url = `${this.baseUrl}/api/files?subject=${encodeURIComponent(subject)}&page=${encodeURIComponent(page)}&years=true`;
    const response = await this.fetchJson<{ years: number[] }>(url);
    return response?.years || [];
  }

  async searchFiles(query: string): Promise<string[]> {
    const url = `${this.baseUrl}/api/files?q=${encodeURIComponent(query)}`;
    const response = await this.fetchJson<{ files: string[] }>(url);
    return response?.files || [];
  }
}

// Singleton instance
export const apiService = new ApiService();
