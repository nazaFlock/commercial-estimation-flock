import { HistoricalRecord } from '../types.js';
import { config } from '../config.js';
import { readJsonFile, writeJsonFile, listJsonFiles, createDirectory } from '../utils/fileUtils.js';
import { logger } from '../utils/logger.js';

class HistoricalDataService {
  constructor() {
    createDirectory(config.paths.historicalEstimatesDir);
  }

  getAllRecords(): HistoricalRecord[] {
    const files = listJsonFiles(config.paths.historicalEstimatesDir);
    const records: HistoricalRecord[] = [];

    for (const file of files) {
      try {
        const record = readJsonFile<HistoricalRecord>(file);
        records.push(record);
      } catch (error) {
        logger.warn(`Failed to load historical record: ${file}`);
      }
    }

    return records;
  }

  addRecord(record: HistoricalRecord): void {
    const filePath = `${config.paths.historicalEstimatesDir}/${record.id}.json`;
    writeJsonFile(filePath, record);
    logger.info(`Added historical record: ${record.id}`);
  }

  findSimilarProjects(
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): HistoricalRecord[] {
    const all = this.getAllRecords();

    return all.filter((record) => {
      const complexityMatch = record.complexity === complexity;
      const techOverlap = technologies.some((tech) => record.technologies.includes(tech));

      return complexityMatch && techOverlap;
    });
  }

  getAverageEffort(records: HistoricalRecord[]): { estimated: number; actual: number | null } {
    if (records.length === 0) {
      return { estimated: 0, actual: null };
    }

    const estimatedSum = records.reduce((sum, r) => sum + r.estimatedHours, 0);
    const estimatedAvg = estimatedSum / records.length;

    const completedRecords = records.filter((r) => r.actualHours !== undefined && r.actualHours !== null);
    const actualAvg =
      completedRecords.length > 0
        ? completedRecords.reduce((sum, r) => sum + (r.actualHours || 0), 0) / completedRecords.length
        : null;

    return { estimated: estimatedAvg, actual: actualAvg };
  }

  getDeviationStats(records: HistoricalRecord[]): { avgDeviation: number; minDeviation: number; maxDeviation: number } | null {
    const withActual = records.filter((r) => r.actualHours !== undefined && r.actualHours !== null);

    if (withActual.length === 0) {
      return null;
    }

    const deviations = withActual.map((r) => {
      const actual = r.actualHours || 0;
      return Math.abs(actual - r.estimatedHours) / r.estimatedHours;
    });

    return {
      avgDeviation: deviations.reduce((a, b) => a + b, 0) / deviations.length,
      minDeviation: Math.min(...deviations),
      maxDeviation: Math.max(...deviations),
    };
  }
}

export const historicalDataService = new HistoricalDataService();
