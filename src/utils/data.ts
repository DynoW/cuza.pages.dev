/**
 * Data processing utilities
 */

export const extractYearsFromPaths = (paths: string[]): number[] => {
  const years = new Set<number>();
  
  paths.forEach(path => {
    const yearMatches = path.match(/\/20\d{2}\//g); // TODO: may crash after 2100
    if (yearMatches) {
      yearMatches.forEach(match => {
        const year = parseInt(match.replace(/\//g, ''), 10);
        years.add(year);
      });
    }
  });
  
  return Array.from(years).sort((a, b) => b - a);
};

export const extractYearsFromStructure = (content: Record<string, any>): number[] => {
  const years = new Set<number>();
  
  const traverseStructure = (obj: Record<string, any>) => {
    for (const [key, value] of Object.entries(obj)) {
      if (/^20\d{2}$/.test(key)) {
        const year = parseInt(key, 10);
        years.add(year);
      }
      
      if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        traverseStructure(value);
      }
    }
  };
  
  traverseStructure(content);
  return Array.from(years).sort((a, b) => b - a);
};

export const isYearFolder = (key: string): boolean => /^20\d{2}$/.test(key);

export const formatKey = (key: string): string => key.replace(/_/g, " ");

export const generateUniqueKey = (key: string, index: number): string => 
  `${key.replace(/-/g, " ")}-${index}`;

export function normalizeUrl(url?: string | null): string {
  if (!url) return '';
  return url.replace(/\/+$/, '');
}
