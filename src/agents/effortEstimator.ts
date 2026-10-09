import { TechnicalAnalysis, EstimationResult, AgentContext } from '../types.js';
import { claudeClient } from '../services/claudeClient.js';
import { logger } from '../utils/logger.js';
import { config } from '../config.js';

const systemPrompt = `Eres un estimador de proyectos senior especializado en estimación de esfuerzo de software.

Tus responsabilidades:
1. Estimar esfuerzo en horas para cada tarea técnica
2. Considerar análisis, desarrollo, testing e integración
3. Proporcionar estimaciones mínima, probable y máxima para incertidumbre
4. Agrupar esfuerzos por módulo y perfil profesional (frontend, backend, QA, etc.)
5. Proporcionar justificación clara para estimaciones
6. Señalar tareas que requieren atención especial o validación humana
7. Las estimaciones deben ser realistas y trazables, no arbitrarias

Directrices de estimación:
- Complejidad baja: 4-8 horas por tarea
- Complejidad media: 16-40 horas por tarea
- Complejidad alta: 64-160 horas por tarea
- Considerar dependencias, curva de aprendizaje y esfuerzo de integración

La salida debe ser un objeto JSON válido con la estructura especificada.
Responde SIEMPRE en español, sin excepción.`;

const userPromptTemplate = `Basándote en el siguiente análisis técnico, proporciona estimación de esfuerzo:

---ANÁLISIS TÉCNICO INICIO---
{technicalAnalysis}
---ANÁLISIS TÉCNICO FIN---

Proporciona una respuesta JSON con esta estructura exacta:
{
  "tasks": [
    {
      "id": "string: task identifier",
      "name": "string: task name",
      "module": "string: module name",
      "complexity": "low|medium|high",
      "minHours": number,
      "likelyHours": number,
      "maxHours": number,
      "profile": "string: backend|frontend|qa|devops|architect",
      "justification": "string: why these estimates"
    }
  ],
  "moduleEffort": [
    {
      "moduleId": "string",
      "moduleName": "string",
      "minHours": number,
      "likelyHours": number,
      "maxHours": number
    }
  ],
  "profileEffort": [
    {
      "profile": "string: backend|frontend|qa|devops|architect",
      "minHours": number,
      "likelyHours": number,
      "maxHours": number,
      "taskCount": number
    }
  ],
  "scenariosHours": {
    "minHours": number,
    "likelyHours": number,
    "maxHours": number,
    "minDays": number,
    "likelyDays": number,
    "maxDays": number
  },
  "criteria": "string: summary of estimation criteria",
  "validationFlags": ["array of tasks or areas requiring human review"]
}`;

export async function estimateEffort(
  technicalAnalysis: TechnicalAnalysis,
  context: AgentContext,
): Promise<EstimationResult> {
  logger.info(`Effort estimator starting estimation for brief: ${context.briefId}`);

  const userPrompt = userPromptTemplate.replace(
    '{technicalAnalysis}',
    JSON.stringify(technicalAnalysis, null, 2),
  );

  try {
    const rawResponse = await claudeClient.sendJsonRequest<EstimationResult>(
      systemPrompt,
      userPrompt,
      {},
    );

    // Convert hours to days
    const hoursPerDay = config.estimation.hoursPerDay;
    rawResponse.scenariosHours.minDays = Math.ceil(rawResponse.scenariosHours.minHours / hoursPerDay);
    rawResponse.scenariosHours.likelyDays = Math.ceil(rawResponse.scenariosHours.likelyHours / hoursPerDay);
    rawResponse.scenariosHours.maxDays = Math.ceil(rawResponse.scenariosHours.maxHours / hoursPerDay);

    logger.info(
      `Estimation completed: ${rawResponse.scenariosHours.likelyHours} likely hours (${rawResponse.scenariosHours.likelyDays} days)`,
    );

    return rawResponse;
  } catch (error) {
    logger.error(
      `Effort estimation failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    context.errors.push(`Effort estimation failed: ${error}`);
    throw error;
  }
}
