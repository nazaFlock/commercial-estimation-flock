import { Brief, FunctionalAnalysis, AgentContext } from '../types.js';
import { claudeClient } from '../services/claudeClient.js';
import { logger } from '../utils/logger.js';

const systemPrompt = `Eres un analista funcional senior especializado en requisitos de proyectos de software.

Tus responsabilidades:
1. Analizar briefs comerciales para identificar objetivos y alcance claros
2. Descomponer el proyecto en módulos y funcionalidades bien definidas
3. Desglosar funcionalidades en requisitos estimables
4. Identificar integraciones externas y dependencias
5. Señalar ambigüedades, brechas e información faltante
6. Nunca inventar requerimientos no mencionados explícitamente en el brief
7. Identificar claramente cualquier supuesto que hagas

La salida debe ser un objeto JSON válido con la estructura especificada.
Responde SIEMPRE en español, sin excepción.`;

const userPromptTemplate = `Analiza el siguiente brief comercial y proporciona un análisis funcional:

---BRIEF INICIO---
{brief}
---BRIEF FIN---

Proporciona una respuesta JSON con esta estructura exacta:
{
  "projectObjective": "string: clear, concise objective",
  "scope": "string: high-level scope description",
  "modules": [
    {
      "id": "string: module identifier",
      "name": "string: module name",
      "description": "string: what this module does",
      "functionalities": [
        {
          "id": "string: functionality identifier",
          "name": "string: functionality name",
          "description": "string: what this functionality does",
          "requirements": ["array of specific requirements"],
          "dependencies": ["array of dependencies"],
          "complexity": "low|medium|high"
        }
      ],
      "priority": "high|medium|low"
    }
  ],
  "externalIntegrations": ["array de integraciones de terceros"],
  "assumptions": ["array de supuestos explícitos"],
  "gaps": ["array de brechas o ambigüedades identificadas"],
  "confidenceLevel": número entre 0 y 1,
  "analysisNotes": "string: notas adicionales"
}

Sé preciso y evita descripciones genéricas.`;

export async function analyzeBrief(brief: Brief, context: AgentContext): Promise<FunctionalAnalysis> {
  logger.info(`Functional analyst starting analysis for brief: ${brief.id}`);

  const userPrompt = userPromptTemplate.replace('{brief}', brief.description);

  try {
    const response = await claudeClient.sendJsonRequest<FunctionalAnalysis>(
      systemPrompt,
      userPrompt,
      {},
    );

    logger.info(`Functional analysis completed with confidence: ${response.confidenceLevel}`);
    return response;
  } catch (error) {
    logger.error(`Functional analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    context.errors.push(`Functional analysis failed: ${error}`);
    throw error;
  }
}
