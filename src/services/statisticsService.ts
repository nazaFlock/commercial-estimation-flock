import { HistoricalRecordExtended } from '../types.js';
import { logger } from '../utils/logger.js';

export interface DescriptiveStatistics {
  count: number;
  sum: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  percentile25: number;
  percentile75: number;
  percentile90: number;
}

export interface RatioStatistics extends DescriptiveStatistics {
  ratioType: 'hours_per_sp' | 'hours_per_task';
}

/**
 * Servicio determinístico para cálculos estadísticos.
 * Independiente de fuentes de datos (Jira, CSV, JSON, etc.)
 */
export class StatisticsService {
  /**
   * Calcula estadística descriptiva de un array de números
   */
  calculateDescriptiveStats(values: number[]): DescriptiveStatistics | null {
    const valid = values.filter((v) => !isNaN(v) && v !== null && v !== undefined);

    if (valid.length === 0) {
      logger.warn('No valid values for statistics calculation');
      return null;
    }

    const sorted = [...valid].sort((a, b) => a - b);
    const sum = valid.reduce((a, b) => a + b, 0);
    const mean = sum / valid.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];

    // Desviación estándar muestral (n-1)
    let standardDeviation = 0;
    if (valid.length >= 2) {
      const variance = valid.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (valid.length - 1);
      standardDeviation = Math.sqrt(variance);
    }

    const cv = mean !== 0 ? standardDeviation / mean : 0;

    // Percentiles
    const percentile25 = this.getPercentile(sorted, 0.25);
    const percentile75 = this.getPercentile(sorted, 0.75);
    const percentile90 = this.getPercentile(sorted, 0.9);

    return {
      count: valid.length,
      sum,
      mean,
      median,
      min,
      max,
      standardDeviation,
      coefficientOfVariation: cv,
      percentile25,
      percentile75,
      percentile90,
    };
  }

  /**
   * Calcula estadísticas de relación horas/SP
   */
  calculateRatioStatistics(records: HistoricalRecordExtended[], ratioType: 'hours_per_sp' | 'hours_per_task' = 'hours_per_sp'): RatioStatistics | null {
    // Filtrar registros con horas reales
    const validRecords = records.filter((r) => r.actualHours && r.actualHours > 0);

    if (validRecords.length === 0) {
      logger.warn('No records with actual hours for ratio calculation');
      return null;
    }

    let ratios: number[] = [];

    if (ratioType === 'hours_per_sp') {
      ratios = validRecords
        .filter((r) => r.storyPointsInitial && r.storyPointsInitial > 0)
        .map((r) => (r.actualHours || 0) / (r.storyPointsInitial || 1));
    } else {
      // Por tarea
      ratios = validRecords.map((r) => r.actualHours || 0);
    }

    if (ratios.length === 0) {
      logger.warn(`No valid data for ${ratioType} calculation`);
      return null;
    }

    const baseStats = this.calculateDescriptiveStats(ratios);
    if (!baseStats) return null;

    return {
      ...baseStats,
      ratioType,
    };
  }

  /**
   * Calcula estadísticas agregadas (suma total, no media de ratios)
   * Importante: distinguir de media de ratios individuales
   */
  calculateAggregateRatio(records: HistoricalRecordExtended[], ratioType: 'hours_per_sp' | 'hours_per_task' = 'hours_per_sp'): { ratio: number; totalHours: number; totalSP: number; taskCount: number } | null {
    const validRecords = records.filter((r) => r.actualHours && r.actualHours > 0);

    if (validRecords.length === 0) {
      return null;
    }

    const totalHours = validRecords.reduce((sum, r) => sum + (r.actualHours || 0), 0);

    if (ratioType === 'hours_per_sp') {
      const totalSP = validRecords.reduce((sum, r) => sum + (r.storyPointsInitial || 0), 0);

      if (totalSP === 0) {
        logger.warn('Total SP is 0, cannot calculate aggregate ratio');
        return null;
      }

      return {
        ratio: totalHours / totalSP,
        totalHours,
        totalSP,
        taskCount: validRecords.length,
      };
    } else {
      return {
        ratio: totalHours / validRecords.length,
        totalHours,
        totalSP: 0,
        taskCount: validRecords.length,
      };
    }
  }

  /**
   * Calcula escenarios (bajo/central/alto) basados en dispersión
   */
  calculateScenarios(value: number, stats: DescriptiveStatistics): { low: number; central: number; high: number } {
    // Usar percentiles como escenarios
    const uncertainty = stats.coefficientOfVariation;

    return {
      low: Math.max(0, value * (1 - uncertainty * 0.5)),
      central: value,
      high: value * (1 + uncertainty * 0.5),
    };
  }

  /**
   * Detecta valores atípicos usando Z-score
   */
  detectOutliers(values: number[], threshold: number = 2.5): { outliers: number[]; indices: number[] } {
    const stats = this.calculateDescriptiveStats(values);
    if (!stats || stats.standardDeviation === 0) {
      return { outliers: [], indices: [] };
    }

    const outliers: number[] = [];
    const indices: number[] = [];

    values.forEach((val, idx) => {
      const zScore = Math.abs((val - stats.mean) / stats.standardDeviation);
      if (zScore > threshold) {
        outliers.push(val);
        indices.push(idx);
      }
    });

    return { outliers, indices };
  }

  /**
   * Calcula percentil de un array ordenado
   */
  private getPercentile(sortedArray: number[], percentile: number): number {
    const index = percentile * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index % 1;

    if (lower === upper) {
      return sortedArray[lower];
    }

    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Valida coherencia entre SP originales y finales
   */
  validateSPConsistency(records: HistoricalRecordExtended[]): { consistent: HistoricalRecordExtended[]; inconsistent: Array<{ record: HistoricalRecordExtended; reason: string }> } {
    const consistent: HistoricalRecordExtended[] = [];
    const inconsistent: Array<{ record: HistoricalRecordExtended; reason: string }> = [];

    for (const record of records) {
      const hasInitial = record.storyPointsInitial && record.storyPointsInitial > 0;
      const hasFinal = record.storyPointsFinal && record.storyPointsFinal > 0;

      if (!hasInitial && !hasFinal) {
        inconsistent.push({ record, reason: 'Missing both storyPointsInitial and storyPointsFinal' });
      } else if (hasInitial && hasFinal && (record.storyPointsFinal as number) > (record.storyPointsInitial as number) * 2) {
        inconsistent.push({
          record,
          reason: `storyPointsFinal (${record.storyPointsFinal}) is > 2x storyPointsInitial (${record.storyPointsInitial})`,
        });
      } else {
        consistent.push(record);
      }
    }

    return { consistent, inconsistent };
  }
}

export const statisticsService = new StatisticsService();
