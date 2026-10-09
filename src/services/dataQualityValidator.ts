import { HistoricalRecordExtended } from '../types.js';
import { statisticsService } from './statisticsService.js';
import { logger } from '../utils/logger.js';

export interface DataQualityReport {
  totalRecords: number;
  validRecords: number;
  completenessPercentage: number;
  issues: DataQualityIssue[];
  outliers: OutlierReport;
  recommendations: string[];
  overallQuality: 'high' | 'medium' | 'low';
}

export interface DataQualityIssue {
  recordId: string;
  type: 'missing_hours' | 'missing_sp' | 'missing_profile' | 'incomplete_backend_frontend' | 'inconsistent_sp' | 'outlier_detected';
  severity: 'warning' | 'error';
  message: string;
}

export interface OutlierReport {
  detectedOutliers: Array<{ recordId: string; value: number; zScore: number }>;
  percentageOutliers: number;
}

/**
 * Valida calidad e integridad de datos históricos
 * Independiente de fuentes (Jira, CSV, JSON)
 */
export class DataQualityValidator {
  /**
   * Realiza validación completa del dataset
   */
  validateDataset(records: HistoricalRecordExtended[]): DataQualityReport {
    const issues: DataQualityIssue[] = [];
    let validCount = 0;

    // Validar cada registro
    for (const record of records) {
      const recordIssues = this.validateRecord(record);
      issues.push(...recordIssues);

      if (recordIssues.length === 0 || recordIssues.every((i) => i.severity === 'warning')) {
        validCount++;
      }
    }

    // Detectar outliers
    const hoursValues = records
      .filter((r) => r.actualHours && r.actualHours > 0)
      .map((r) => r.actualHours || 0);

    const outlierReport = this.detectOutliers(records, hoursValues);

    // Calcular completitud
    const completeness = records.length > 0 ? (validCount / records.length) * 100 : 0;

    // Determinar calidad general
    const quality = this.determineQualityLevel(completeness, outlierReport.percentageOutliers, issues);

    // Generar recomendaciones
    const recommendations = this.generateRecommendations(completeness, outlierReport, issues, records.length);

    return {
      totalRecords: records.length,
      validRecords: validCount,
      completenessPercentage: completeness,
      issues,
      outliers: outlierReport,
      recommendations,
      overallQuality: quality,
    };
  }

  /**
   * Valida un registro individual
   */
  private validateRecord(record: HistoricalRecordExtended): DataQualityIssue[] {
    const issues: DataQualityIssue[] = [];

    // Validar horas reales
    if (!record.actualHours || record.actualHours === 0) {
      if (record.status === 'completed') {
        issues.push({
          recordId: record.id,
          type: 'missing_hours',
          severity: 'error',
          message: `Completed task ${record.id} has no actual hours recorded`,
        });
      } else {
        issues.push({
          recordId: record.id,
          type: 'missing_hours',
          severity: 'warning',
          message: `Task ${record.id} has no actual hours (status: ${record.status})`,
        });
      }
    }

    // Validar Story Points iniciales
    if (!record.storyPointsInitial || record.storyPointsInitial === 0) {
      issues.push({
        recordId: record.id,
        type: 'missing_sp',
        severity: 'warning',
        message: `Task ${record.id} has no storyPointsInitial`,
      });
    }

    // Validar perfil
    if (!record.responsibleProfile) {
      issues.push({
        recordId: record.id,
        type: 'missing_profile',
        severity: 'warning',
        message: `Task ${record.id} has no responsibleProfile`,
      });
    }

    // Validar Backend/Frontend split
    const hasBackend = record.backend !== undefined && record.backend !== null;
    const hasFrontend = record.frontend !== undefined && record.frontend !== null;

    if (!hasBackend && !hasFrontend) {
      issues.push({
        recordId: record.id,
        type: 'incomplete_backend_frontend',
        severity: 'warning',
        message: `Task ${record.id} lacks backend/frontend classification`,
      });
    }

    // Validar consistencia SP
    if (record.storyPointsInitial && record.storyPointsFinal) {
      if (record.storyPointsFinal > record.storyPointsInitial * 2) {
        issues.push({
          recordId: record.id,
          type: 'inconsistent_sp',
          severity: 'warning',
          message: `Story points changed significantly: ${record.storyPointsInitial} → ${record.storyPointsFinal}`,
        });
      }
    }

    return issues;
  }

  /**
   * Detecta outliers en horas reales
   */
  private detectOutliers(records: HistoricalRecordExtended[], hoursValues: number[]): OutlierReport {
    const { outliers, indices } = statisticsService.detectOutliers(hoursValues, 2.5);

    const detectedOutliers = indices.map((idx) => {
      const record = records.filter((r) => r.actualHours && r.actualHours > 0)[idx];
      const stats = statisticsService.calculateDescriptiveStats(hoursValues);
      const zScore = stats ? Math.abs((hoursValues[idx] - stats.mean) / stats.standardDeviation) : 0;

      return {
        recordId: record?.id || 'unknown',
        value: hoursValues[idx],
        zScore,
      };
    });

    return {
      detectedOutliers,
      percentageOutliers: records.length > 0 ? (outliers.length / records.length) * 100 : 0,
    };
  }

  /**
   * Determina nivel de calidad general
   */
  private determineQualityLevel(completeness: number, outlierPercentage: number, issues: DataQualityIssue[]): 'high' | 'medium' | 'low' {
    const errorCount = issues.filter((i) => i.severity === 'error').length;

    if (completeness < 50 || errorCount > 5 || outlierPercentage > 30) {
      return 'low';
    }

    if (completeness < 80 || errorCount > 2 || outlierPercentage > 15) {
      return 'medium';
    }

    return 'high';
  }

  /**
   * Genera recomendaciones basadas en validación
   */
  private generateRecommendations(completeness: number, outliers: OutlierReport, issues: DataQualityIssue[], totalRecords: number): string[] {
    const recommendations: string[] = [];

    if (completeness < 50) {
      recommendations.push('Critical: Dataset completeness is below 50%. Consider collecting more data before using for calibration.');
    }

    if (completeness < 80) {
      recommendations.push('Dataset has gaps. Fill missing hours/SP fields for better calibration accuracy.');
    }

    if (outliers.percentageOutliers > 15) {
      recommendations.push('Multiple outliers detected. Review marked outliers before calibration; they may represent special cases.');
    }

    if (totalRecords < 10) {
      recommendations.push('Less than 10 records available. Statistical estimates will have high uncertainty. Consider using manual calibration factors.');
    }

    if (totalRecords < 20) {
      recommendations.push('Dataset size is below recommended minimum (20 records). Proportional model preferred over regression.');
    }

    const errorCount = issues.filter((i) => i.severity === 'error').length;
    if (errorCount > 2) {
      recommendations.push(`${errorCount} critical issues found. Please resolve errors before using for estimation.`);
    }

    return recommendations;
  }
}

export const dataQualityValidator = new DataQualityValidator();
