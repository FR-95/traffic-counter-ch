import { mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface CacheEntry {
  data: string;
  savedAt: string;
}

/** Hält die letzten erfolgreichen API-Antworten auf Disk, damit ein Neustart ohne API-Verbindung Daten hat. */
export class DiskCache {
  private readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  async read(name: string): Promise<CacheEntry | null> {
    const file = path.join(this.dir, name);
    try {
      const [data, info] = await Promise.all([readFile(file, 'utf8'), stat(file)]);
      return { data, savedAt: info.mtime.toISOString() };
    } catch {
      return null;
    }
  }

  async write(name: string, data: string): Promise<void> {
    const file = path.join(this.dir, name);
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(`${file}.tmp`, data);
      await rename(`${file}.tmp`, file);
    } catch (error) {
      console.warn(`Cache ${file} konnte nicht geschrieben werden:`, error instanceof Error ? error.message : error);
    }
  }
}
