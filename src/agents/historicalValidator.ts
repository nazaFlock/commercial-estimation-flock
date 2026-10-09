import {
  TechnicalAnalysis,
  EstimationResult,
  HistoricalComparison,
  AgentContext,
  ReferenceSelection,
  MCPConnection,
} from '../types.js';
import { historicalDataService } from '../services/historicalDataService.js';
import { mcpConnectorService } from '../services/mcpConnectorService.js';
import { claudeClient } from '../services/claudeClient.js';
import { logger } from '../utils/logger.js';

const systemPrompt = `Eres un analista senior especializado en datos históricos de proyectos y validación de estimaciones.

Tus responsabilidades:
1. Analizar estimación actual contra datos históricos
2. Identificar proyectos similares pasados por complejidad, tecnologías y alcance
3. Comparar esfuerzo estimado con esfuerzo real histórico
4. Señalar desviaciones significativas
5. Recomendar ajustes basados en evidencia
6. Nunca fabricar datos históricos que no existen
7. Distinguir entre horas estimadas y reales en registros históricos

Cuando no existan datos suficientes, sé explícito sobre ello y proporciona insights cualitativos en su lugar.
Responde SIEMPRE en español, sin excepción.`;

const userPromptTemplate = `Basándote en el siguiente análisis técnico y estimación, valida contra datos históricos:

---ANÁLISIS TÉCNICO INICIO---
{technicalAnalysis}
---ANÁLISIS TÉCNICO FIN---

---ESTIMACIÓN ACTUAL INICIO---
{estimation}
---ESTIMACIÓN ACTUAL FIN---

---DATOS HISTÓRICOS INICIO---
{historicalData}
---DATOS HISTÓRICOS FIN---

Proporciona una respuesta JSON con esta estructura exacta:
{
  "similarProjects": [
    {
      "id": "string: project id",
      "projectType": "string",
      "complexity": "low|medium|high",
      "estimatedHours": number,
      "actualHours": number or null,
      "variance": "string: how much they differed"
    }
  ],
  "deviations": ["array of notable deviations from historical patterns"],
  "recommendations": ["array of specific recommendations based on historical data"],
  "availableData": boolean
}`;

export async function validateHistorical(
  technicalAnalysis: TechnicalAnalysis,
  estimation: EstimationResult,
  context: AgentContext,
  referenceSelection?: ReferenceSelection,
  connection?: MCPConnection,
): Promise<HistoricalComparison> {
  logger.info(`Historical validator starting validation for brief: ${context.briefId}`);

  let allRecords = historicalDataService.getAllRecords();
  let similarProjects = historicalDataService.findSimilarProjects('medium',
    technicalAnalysis.technologyStack.map((t) => t.name));

  // Si se proporciona referenceSelection con una fuente específica, usar el adapter
  if (referenceSelection?.source && referenceSelection.source !== 'file') {
    try {
      const connectionId = connection?.id || referenceSelection.source;
      const adapter = mcpConnectorService.getAdapter(connectionId);

      if (adapter) {
        logger.info(`Using ${referenceSelection.source} adapter for historical references`);
        const technologies = technicalAnalysis.technologyStack.map((t) => t.name);
        allRecords = await adapter.queryBySimilarity('medium', technologies);
        similarProjects = allRecords;
      }
    } catch (error) {
      logger.warn(`Failed to fetch from ${referenceSelection.source}, falling back to local: ${error}`);
    }
  }

  if (allRecords.length === 0) {
    logger.warn('No historical data available for validation');
    return {
      similarProjects: [],
      deviations: ['No historical data available for comparison'],
      recommendations: ['Collect actual effort data from this project for future comparisons'],
      availableData: false,
    };
  }

  const historicalSummary = {
    totalRecords: allRecords.length,
    similarProjects: similarProjects.length,
    averageEffort: historicalDataService.getAverageEffort(similarProjects),
    deviationStats: historicalDataService.getDeviationStats(similarProjects),
    sourceSelection: referenceSelection ? {
      mode: referenceSelection.mode,
      source: referenceSelection.source || 'file',
    } : undefined,
  };

  const userPrompt = userPromptTemplate
    .replace('{technicalAnalysis}', JSON.stringify(technicalAnalysis, null, 2))
    .replace('{estimation}', JSON.stringify(estimation, null, 2))
    .replace('{historicalData}', JSON.stringify(historicalSummary, null, 2));

  try {
    const response = await claudeClient.sendJsonRequest<HistoricalComparison>(
      systemPrompt,
      userPrompt,
      {},
    );

    logger.info(
      `Historical validation completed: ${response.similarProjects.length} similar projects found`,
    );
    return response;
  } catch (error) {
    logger.warn(`Historical validation failed: ${error instanceof Error ? error.message : String(error)}`);
    return {
      similarProjects: [],
      deviations: [],
      recommendations: [],
      availableData: false,
    };
  }
}
