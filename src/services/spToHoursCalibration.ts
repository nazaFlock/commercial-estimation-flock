import { HistoricalRecordExtended } from '../types.js';
import { statisticsService, RatioStatistics } from './statisticsService.js';
import { logger } from '../utils/logger.js';

export interface CalibrationFactor {
  profile: 'backend' | 'frontend';
  hoursPerSP: number;
  taskCount: number;
  totalSP: number;
  totalHours: number;
  aggregateRatio: number;
  meanRatio: number;
  standardDeviation: number;
  coefficientOfVariation: number;
  model: 'proportional' | 'linear_regression';
  regressionParams?: { intercept: number; slope: number };
  meanAbsoluteError?: number;
  rootMeanSquaredError?: number;
  dataQuality: 'high' | 'medium' | 'low';
  source: string;
  dateRange: { from: string; to: string };
  notes: string;
}

export interface ProjectionResult {
  profile: 'backend' | 'frontend';
  storyPoints: number;
  hoursProjected: number;
  factor: number;
  scenario: { low: number; central: number; high: number };
  calibrationSource: string;
}

/**
 * Servicio para calibración de Story Points a Horas.
 * Independiente de MCP y fuentes de datos.
 */
export class SPToHoursCalibration {
  /**
   * Calcula factor de calibración SP→Horas para un perfil
   */
  calibrateProfile(
    records: HistoricalRecordExtended[],
    profile: 'backend' | 'frontend',
    source: string = 'unknown',
  ): CalibrationFactor | null {
    // Filtrar por perfil
    const filtered = records.filter((r) => {
      if (profile === 'backend') {
        return r.backend === true || (r.backend === undefined && r.responsibleProfile?.toLowerCase().includes('backend'));
      } else {
        return r.frontend === true || (r.frontend === undefined && r.responsibleProfile?.toLowerCase().includes('frontend'));
      }
    });

    if (filtered.length === 0) {
      logger.warn(`No records found for profile: ${profile}`);
      return null;
    }

    // Calcular ratio estadístico
    const ratioStats = statisticsService.calculateRatioStatistics(filtered, 'hours_per_sp');
    if (!ratioStats) {
      logger.warn(`No valid ratios for profile: ${profile}`);
      return null;
    }

    // Calcular ratio agregado
    const aggregateData = statisticsService.calculateAggregateRatio(filtered, 'hours_per_sp');
    if (!aggregateData) {
      logger.warn(`No aggregate data for profile: ${profile}`);
      return null;
    }

    // Determinar modelo
    const useRegression = filtered.length >= 20;
    let model: 'proportional' | 'linear_regression' = 'proportional';
    let regressionParams: { intercept: number; slope: number } | undefined;
    let mae: number | undefined;
    let rmse: number | undefined;

    if (useRegression) {
      const regression = this.calculateLinearRegression(filtered);
      if (regression) {
        model = 'linear_regression';
        regressionParams = regression.params;
        mae = regression.mae;
        rmse = regression.rmse;
      }
    }

    const quality = this.determineDataQuality(filtered.length, ratioStats.coefficientOfVariation);
    const dateRange = this.getDateRange(filtered);

    return {
      profile,
      hoursPerSP: aggregateData.ratio,
      taskCount: aggregateData.taskCount,
      totalSP: aggregateData.totalSP,
      totalHours: aggregateData.totalHours,
      aggregateRatio: aggregateData.ratio,
      meanRatio: ratioStats.mean,
      standardDeviation: ratioStats.standardDeviation,
      coefficientOfVariation: ratioStats.coefficientOfVariation,
      model,
      regressionParams,
      meanAbsoluteError: mae,
      rootMeanSquaredError: rmse,
      dataQuality: quality,
      source,
      dateRange,
      notes: `Calibrated from ${aggregateData.taskCount} completed tasks. Ratio: ${aggregateData.ratio.toFixed(2)} h/SP`,
    };
  }

  /**
   * Proyecta horas para nuevas tareas basadas en calibración
   */
  projectHours(storyPoints: number, calibration: CalibrationFactor): ProjectionResult {
    let hoursProjected: number;

    if (calibration.model === 'linear_regression' && calibration.regressionParams) {
      hoursProjected = calibration.regressionParams.intercept + calibration.regressionParams.slope * storyPoints;
    } else {
      hoursProjected = storyPoints * calibration.hoursPerSP;
    }

    // Evitar predicciones negativas
    hoursProjected = Math.max(0, hoursProjected);

    // Calcular escenarios basados en dispersión
    const baseStats = statisticsService.calculateDescriptiveStats([hoursProjected]);
    let scenarios = { low: hoursProjected * 0.8, central: hoursProjected, high: hoursProjected * 1.2 };

    if (baseStats) {
      const cv = calibration.coefficientOfVariation;
      scenarios = {
        low: Math.max(0, hoursProjected * (1 - cv * 0.5)),
        central: hoursProjected,
        high: hoursProjected * (1 + cv * 0.5),
      };
    }

    return {
      profile: calibration.profile,
      storyPoints,
      hoursProjected,
      factor: calibration.hoursPerSP,
      scenario: scenarios,
      calibrationSource: calibration.source,
    };
  }

  /**
   * Calcula regresión lineal: Horas = β₀ + β₁ × SP
   */
  private calculateLinearRegression(
    records: HistoricalRecordExtended[],
  ): { params: { intercept: number; slope: number }; mae: number; rmse: number } | null {
    const validRecords = records.filter((r) => r.actualHours && r.actualHours > 0 && r.storyPointsInitial && r.storyPointsInitial > 0);

    if (validRecords.length < 3) {
      logger.warn('Insufficient data for linear regression (need >= 3 records)');
      return null;
    }

    const n = validRecords.length;
    const xValues = validRecords.map((r) => r.storyPointsInitial || 0);
    const yValues = validRecords.map((r) => r.actualHours || 0);

    const sumX = xValues.reduce((a, b) => a + b, 0);
    const sumY = yValues.reduce((a, b) => a + b, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumX2 = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calcular errores
    const predictions = xValues.map((x) => intercept + slope * x);
    const mae = yValues.reduce((sum, y, i) => sum + Math.abs(y - predictions[i]), 0) / n;
    const rmse = Math.sqrt(yValues.reduce((sum, y, i) => sum + Math.pow(y - predictions[i], 2), 0) / n);

    return {
      params: { intercept, slope },
      mae,
      rmse,
    };
  }

  /**
   * Determina calidad de datos para calibración
   */
  private determineDataQuality(taskCount: number, cv: number): 'high' | 'medium' | 'low' {
    if (taskCount < 5 || cv > 0.8) {
      return 'low';
    }

    if (taskCount < 10 || cv > 0.5) {
      return 'medium';
    }

    return 'high';
  }

  /**
   * Extrae rango de fechas del dataset
   */
  private getDateRange(records: HistoricalRecordExtended[]): { from: string; to: string } {
    const dates = records
      .filter((r) => r.date)
      .map((r) => new Date(r.date))
      .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) {
      const today = new Date().toISOString().split('T')[0];
      return { from: today, to: today };
    }

    return {
      from: dates[0].toISOString().split('T')[0],
      to: dates[dates.length - 1].toISOString().split('T')[0],
    };
  }
}

export const spToHoursCalibration = new SPToHoursCalibration();
