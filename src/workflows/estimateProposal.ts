import {
  Brief,
  EstimationReport,
  AgentContext,
  ReferenceSelection,
  MCPConnection,
} from '../types.js';
import { analyzeBrief } from '../agents/functionalAnalyst.js';
import { analyzeTechnical } from '../agents/technicalAnalyst.js';
import { estimateEffort } from '../agents/effortEstimator.js';
import { validateHistorical } from '../agents/historicalValidator.js';
import { projectionService } from '../services/projectionService.js';
import { logger } from '../utils/logger.js';
import { generateUniqueId } from '../utils/fileUtils.js';

export async function executeEstimateProposal(
  brief: Brief,
  referenceSelection?: ReferenceSelection,
  connection?: MCPConnection,
): Promise<EstimationReport> {
  const context: AgentContext = {
    briefId: brief.id,
    brief,
    errors: [],
  };

  logger.info(`Starting estimate-proposal workflow for brief: ${brief.id}`);
  if (referenceSelection) {
    logger.info(`Reference selection mode: ${referenceSelection.mode}, source: ${referenceSelection.source}`);
  }

  try {
    // Stage 1: Functional Analysis
    logger.info('Stage 1: Functional Analysis');
    context.functionalAnalysis = await analyzeBrief(brief, context);

    // Stage 2: Technical Analysis
    logger.info('Stage 2: Technical Analysis');
    context.technicalAnalysis = await analyzeTechnical(context.functionalAnalysis, context);

    // Stage 3: Effort Estimation
    logger.info('Stage 3: Effort Estimation');
    context.estimation = await estimateEffort(context.technicalAnalysis, context);

    // Stage 4: Historical Validation
    logger.info('Stage 4: Historical Validation');
    context.historicalComparison = await validateHistorical(
      context.technicalAnalysis,
      context.estimation,
      context,
      referenceSelection,
      connection,
    );

    // Stage 5: Statistical Analysis & Projection (if historical data available)
    logger.info('Stage 5: Statistical Analysis & Projection');
    try {
      if (context.historicalComparison?.availableData && context.historicalComparison.similarProjects.length > 0) {
        const projectionSummary = projectionService.projectProposal(
          context.technicalAnalysis,
          context.historicalComparison.similarProjects as any,
          referenceSelection?.source || 'file',
        );
        context.statisticalAnalysis = {
          referenceSource: referenceSelection?.source || 'file',
          recordsUsed: context.historicalComparison.similarProjects.length,
          dateRange: { from: 'N/A', to: 'N/A' },
          projectionSummary: {
            totalStoryPointsBackend: projectionSummary.totalStoryPointsBackend,
            totalStoryPointsFrontend: projectionSummary.totalStoryPointsFrontend,
            hoursBackend: projectionSummary.hoursBackend,
            hoursFrontend: projectionSummary.hoursFrontend,
            totalHours: projectionSummary.totalHours,
            scenarioLow: projectionSummary.scenarioLow,
            scenarioCentral: projectionSummary.scenarioCentral,
            scenarioHigh: projectionSummary.scenarioHigh,
            calibrationQuality: projectionSummary.calibrationQuality,
          },
          warnings: projectionSummary.warnings,
        };
        logger.info('Statistical analysis completed');
      } else {
        logger.info('Skipping statistical analysis: insufficient historical data');
      }
    } catch (projectionError) {
      logger.warn(`Statistical analysis failed (non-blocking): ${projectionError}`);
      // Continue without statistical analysis - it's enhancement, not critical
    }

    // Generate final report
    logger.info('Generating final report');
    const report = generateReport(brief, context);

    return report;
  } catch (error) {
    logger.error(`Workflow failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

function generateReport(brief: Brief, context: AgentContext): EstimationReport {
  if (!context.functionalAnalysis || !context.technicalAnalysis || !context.estimation) {
    throw new Error('Missing required analysis stages');
  }

  const scenarios = context.estimation.scenariosHours;
  const confidenceFactors = [
    context.functionalAnalysis.confidenceLevel >= 0.8 ? 'Clear functional requirements' : 'Ambiguous requirements',
    context.technicalAnalysis.risks.length === 0 ? 'No major technical risks' : `${context.technicalAnalysis.risks.length} identified risks`,
    context.historicalComparison?.availableData ? 'Historical data available' : 'No historical reference',
  ];

  // Calculate confidence percentage (0-100) based on multiple factors
  const functionalConfidence = context.functionalAnalysis.confidenceLevel * 100; // 0-100
  const technicalConfidence = Math.max(0, 100 - (context.technicalAnalysis.risks.length * 10)); // Subtract 10% per risk
  const historicalConfidence = context.historicalComparison?.availableData ? 80 : 40; // 80% with data, 40% without

  // Weighted average: 40% functional, 30% technical, 30% historical
  const overallConfidence = Math.round(
    functionalConfidence * 0.4 + technicalConfidence * 0.3 + historicalConfidence * 0.3,
  );

  let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
  if (overallConfidence >= 75) {
    confidenceLevel = 'high';
  } else if (overallConfidence < 50) {
    confidenceLevel = 'low';
  }

  return {
    id: generateUniqueId(),
    briefId: brief.id,
    generatedAt: new Date().toISOString(),
    executiveSummary: `Project estimation for "${brief.title}". Estimated effort: ${scenarios.likelyHours} hours (≈${scenarios.likelyDays} work days). Range: ${scenarios.minHours}–${scenarios.maxHours} hours.`,
    functionalAnalysis: context.functionalAnalysis,
    technicalAnalysis: context.technicalAnalysis,
    estimation: context.estimation,
    historicalComparison: context.historicalComparison || { similarProjects: [], deviations: [], recommendations: [], availableData: false },
    statisticalAnalysis: context.statisticalAnalysis,
    assumptions: context.functionalAnalysis.assumptions,
    exclusions: [
      'Deployment and DevOps infrastructure setup',
      'Production monitoring and alerting',
      'Documentation beyond technical specs',
      'User training and onboarding',
    ],
    pendingValidation: context.estimation.validationFlags,
    confidenceLevel,
    confidenceJustification: `Confidence is ${confidenceLevel} (${overallConfidence}%) based on: Functional clarity (${functionalConfidence.toFixed(0)}%), Technical complexity (${technicalConfidence.toFixed(0)}%), Historical data (${historicalConfidence.toFixed(0)}%)`,
  };
}
