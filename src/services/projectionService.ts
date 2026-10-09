import { TechnicalAnalysis, EstimatedTask, HistoricalRecordExtended } from '../types.js';
import { spToHoursCalibration, CalibrationFactor } from './spToHoursCalibration.js';
import { statisticsService } from './statisticsService.js';
import { dataQualityValidator } from './dataQualityValidator.js';
import { logger } from '../utils/logger.js';

export interface ProjectionBreakdown {
  module: string;
  task: string;
  profile: 'backend' | 'frontend';
  storyPoints: number;
  hoursProjected: number;
  hoursLow: number;
  hoursHigh: number;
  calibrationFactor: number;
  referencesUsed: number;
}

export interface ProjectionSummary {
  totalStoryPoints: number;
  totalStoryPointsBackend: number;
  totalStoryPointsFrontend: number;
  hoursBackend: number;
  hoursFrontend: number;
  totalHours: number;
  scenarioLow: number;
  scenarioCentral: number;
  scenarioHigh: number;
  calibrationQuality: 'high' | 'medium' | 'low';
  warnings: string[];
  breakdown: ProjectionBreakdown[];
}

/**
 * Servicio que orquesta la proyección de horas para nuevas propuestas
 * usando calibración histórica
 */
export class ProjectionService {
  /**
   * Proyecta horas de desarrollo para una propuesta técnica
   */
  projectProposal(technicalAnalysis: TechnicalAnalysis, historicalRecords: HistoricalRecordExtended[], source: string = 'historical'): ProjectionSummary {
    // Validar datos históricos
    const qualityReport = dataQualityValidator.validateDataset(historicalRecords);

    if (historicalRecords.length < 3) {
      logger.warn('Insufficient historical data for projection. Consider manual calibration.');
    }

    // Calibrar factores para Backend y Frontend
    const backendCalibration = spToHoursCalibration.calibrateProfile(historicalRecords, 'backend', source);
    const frontendCalibration = spToHoursCalibration.calibrateProfile(historicalRecords, 'frontend', source);

    // Procesar tasks de la propuesta
    const breakdown: ProjectionBreakdown[] = [];
    let totalBackendHours = 0;
    let totalFrontendHours = 0;
    let totalBackendSP = 0;
    let totalFrontendSP = 0;

    for (const component of technicalAnalysis.components) {
      // Determinar si es backend o frontend
      const isBackend = component.type === 'backend' || component.type === 'integration' || component.type === 'database';
      const isFrontend = component.type === 'frontend';

      for (const task of component.tasks) {
        // Estimar Story Points (usar complejidad como proxy)
        const estimatedSP = this.complexityToStoryPoints(task.complexity);

        // Obtener calibración apropiada
        let calibration: CalibrationFactor | null = null;
        let profile: 'backend' | 'frontend' = 'backend';

        if (isFrontend && frontendCalibration) {
          calibration = frontendCalibration;
          profile = 'frontend';
        } else if (isBackend && backendCalibration) {
          calibration = backendCalibration;
          profile = 'backend';
        } else if (backendCalibration) {
          // Fallback a backend si no hay calibración del perfil requerido
          calibration = backendCalibration;
          profile = 'backend';
        }

        if (!calibration) {
          logger.warn(`No calibration available for ${profile}. Skipping projection for task: ${task.name}`);
          continue;
        }

        // Proyectar horas
        const projection = spToHoursCalibration.projectHours(estimatedSP, calibration);

        breakdown.push({
          module: component.name,
          task: task.name,
          profile,
          storyPoints: estimatedSP,
          hoursProjected: projection.hoursProjected,
          hoursLow: projection.scenario.low,
          hoursHigh: projection.scenario.high,
          calibrationFactor: projection.factor,
          referencesUsed: calibration.taskCount,
        });

        if (profile === 'backend') {
          totalBackendHours += projection.hoursProjected;
          totalBackendSP += estimatedSP;
        } else {
          totalFrontendHours += projection.hoursProjected;
          totalFrontendSP += estimatedSP;
        }
      }
    }

    const totalHours = totalBackendHours + totalFrontendHours;
    const totalSP = totalBackendSP + totalFrontendSP;

    // Calcular escenarios
    const uncertaintyBackend = backendCalibration?.coefficientOfVariation || 0.3;
    const uncertaintyFrontend = frontendCalibration?.coefficientOfVariation || 0.3;

    const hoursLow = totalBackendHours * (1 - uncertaintyBackend * 0.5) + totalFrontendHours * (1 - uncertaintyFrontend * 0.5);
    const hoursHigh = totalBackendHours * (1 + uncertaintyBackend * 0.5) + totalFrontendHours * (1 + uncertaintyFrontend * 0.5);

    // Generar advertencias
    const warnings: string[] = [];

    if (qualityReport.overallQuality === 'low') {
      warnings.push('Historical data quality is LOW. Projections are uncertain.');
    }

    if (backendCalibration && backendCalibration.coefficientOfVariation > 0.8) {
      warnings.push('Backend calibration has high variability (CV > 0.8). Estimates may be unreliable.');
    }

    if (frontendCalibration && frontendCalibration.coefficientOfVariation > 0.8) {
      warnings.push('Frontend calibration has high variability (CV > 0.8). Estimates may be unreliable.');
    }

    if (!backendCalibration && totalBackendSP > 0) {
      warnings.push('No backend calibration available. Using fallback estimation.');
    }

    if (!frontendCalibration && totalFrontendSP > 0) {
      warnings.push('No frontend calibration available. Using fallback estimation.');
    }

    const calibrationQuality = this.determineOverallCalibrationQuality(backendCalibration, frontendCalibration, qualityReport.overallQuality);

    return {
      totalStoryPoints: totalSP,
      totalStoryPointsBackend: totalBackendSP,
      totalStoryPointsFrontend: totalFrontendSP,
      hoursBackend: totalBackendHours,
      hoursFrontend: totalFrontendHours,
      totalHours,
      scenarioLow: hoursLow,
      scenarioCentral: totalHours,
      scenarioHigh: hoursHigh,
      calibrationQuality,
      warnings,
      breakdown,
    };
  }

  /**
   * Convierte complejidad a Story Points estimados
   * Útil cuando no hay SP disponibles
   */
  private complexityToStoryPoints(complexity: 'low' | 'medium' | 'high'): number {
    switch (complexity) {
      case 'low':
        return 3;
      case 'medium':
        return 5;
      case 'high':
        return 8;
    }
  }

  /**
   * Determina calidad general de calibración
   */
  private determineOverallCalibrationQuality(
    backendCal: CalibrationFactor | null,
    frontendCal: CalibrationFactor | null,
    dataQuality: 'high' | 'medium' | 'low',
  ): 'high' | 'medium' | 'low' {
    if (dataQuality === 'low' || (!backendCal && !frontendCal)) {
      return 'low';
    }

    const calibrations = [backendCal, frontendCal].filter((c): c is CalibrationFactor => c !== null);

    if (calibrations.some((c) => c.dataQuality === 'low')) {
      return 'medium';
    }

    if (calibrations.every((c) => c.dataQuality === 'high')) {
      return 'high';
    }

    return 'medium';
  }
}

export const projectionService = new ProjectionService();
