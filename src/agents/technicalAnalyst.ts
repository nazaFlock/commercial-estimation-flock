import { FunctionalAnalysis, TechnicalAnalysis, AgentContext } from '../types.js';
import { claudeClient } from '../services/claudeClient.js';
import { logger } from '../utils/logger.js';

const systemPrompt = `Eres un arquitecto técnico senior especializado en diseño de proyectos de software.

Tus responsabilidades:
1. Revisar requisitos funcionales y proponer componentes técnicos
2. Identificar necesidades de backend, frontend, base de datos, integración y testing
3. Evaluar complejidad técnica para cada componente
4. Identificar dependencias, riesgos y preocupaciones técnicas
5. Proponer solo tecnologías que estén justificadas o sean comúnmente usadas (no inventar)
6. Desglosar cada componente en tareas técnicas concretas

La salida debe ser un objeto JSON válido con la estructura especificada.
Responde SIEMPRE en español, sin excepción.`;

const userPromptTemplate = `Basándote en el siguiente análisis funcional, proporciona un análisis técnico:

---ANÁLISIS FUNCIONAL INICIO---
{functionalAnalysis}
---ANÁLISIS FUNCIONAL FIN---

Proporciona una respuesta JSON con esta estructura exacta:
{
  "components": [
    {
      "name": "string: component name",
      "description": "string: what this component does",
      "type": "backend|frontend|database|integration|testing",
      "complexity": "low|medium|high",
      "rationale": "string: why this component is needed",
      "tasks": [
        {
          "id": "string: task identifier",
          "name": "string: task name",
          "description": "string: task description",
          "complexity": "low|medium|high",
          "estimatedDays": number optional,
          "dependencies": ["array of dependency task ids"]
        }
      ]
    }
  ],
  "architecture": "string: brief architectural description",
  "technologyStack": [
    {
      "name": "string: technology name",
      "category": "string: backend|frontend|database|etc",
      "justification": "string: why this technology"
    }
  ],
  "risks": [
    {
      "description": "string: risk description",
      "likelihood": "low|medium|high",
      "impact": "low|medium|high",
      "mitigation": "string: optional mitigation strategy"
    }
  ],
  "dependencies": ["array of external dependencies"],
  "developmentConcerns": ["array of technical concerns"]
}`;

export async function analyzeTechnical(
  functionalAnalysis: FunctionalAnalysis,
  context: AgentContext,
): Promise<TechnicalAnalysis> {
  logger.info(`Technical analyst starting analysis for brief: ${context.briefId}`);

  const userPrompt = userPromptTemplate.replace(
    '{functionalAnalysis}',
    JSON.stringify(functionalAnalysis, null, 2),
  );

  try {
    const response = await claudeClient.sendJsonRequest<TechnicalAnalysis>(
      systemPrompt,
      userPrompt,
      {},
    );

    logger.info(`Technical analysis completed with ${response.components.length} components`);
    return response;
  } catch (error) {
    logger.error(`Technical analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    context.errors.push(`Technical analysis failed: ${error}`);
    throw error;
  }
}
