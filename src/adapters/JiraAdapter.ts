import { BaseHistoricalReferenceProvider } from './HistoricalReferenceProvider.js';
import { HistoricalRecordExtended } from '../types.js';
import { agentClient } from '../services/agentClient.js';
import { logger } from '../utils/logger.js';

interface JiraIssue {
  key: string;
  fields: {
    summary: string;
    description?: string;
    status?: { name: string };
    components?: Array<{ name: string }>;
    customfield_10016?: number; // Story Points
    timetracking?: { timeSpent: string; timeSpentSeconds: number };
    created: string;
    updated: string;
    labels?: string[];
    issuetype?: { name: string };
  };
}

/**
 * Adapter para referencias históricas desde Jira (vía fedpat-jira MCP).
 * Consulta issues completadas del proyecto y extrae esfuerzo real.
 *
 * NOTA: Requiere que fedpat-jira MCP esté disponible en la sesión.
 * Si no está disponible, retorna vacío (fallback a JSON local).
 */
export class JiraAdapter extends BaseHistoricalReferenceProvider {
  name = 'Jira (fedpat-jira)';
  type: 'jira' = 'jira';

  private config: {
    connectionId: string;
    project: string;
    maxResults?: number;
  };
  private cache: HistoricalRecordExtended[] | null = null;

  constructor(config: { connectionId: string; project: string; maxResults?: number }) {
    super();
    this.config = config;
  }

  async fetchRecords(): Promise<HistoricalRecordExtended[]> {
    try {
      if (this.cache) {
        logger.debug('JiraAdapter: Usando cache');
        return this.cache;
      }

      logger.debug(`JiraAdapter: Conectando a Jira - proyecto: ${this.config.project}`);
      logger.info('JiraAdapter: Intentando invocar jira_search...');

      const jql = `status = Done AND project = ${this.config.project} AND type in (Story, Task) ORDER BY updated DESC`;
      const maxResults = this.config.maxResults || 100;

      try {
        const searchResponse = await agentClient.jiraSearch(jql, maxResults);

        if (!searchResponse) {
          logger.warn('JiraAdapter: No se recibieron resultados de jira_search');
          return [];
        }

        // Extraer issues de la respuesta
        let issues: JiraIssue[] = [];
        try {
          let data = searchResponse;
          if (typeof searchResponse === 'string') {
            data = JSON.parse(searchResponse);
          }
          if (typeof data === 'object' && data !== null) {
            issues = (data as any).issues || (Array.isArray(data) ? data : []);
          }
        } catch (parseError) {
          logger.warn(`JiraAdapter: Error parseando respuesta: ${parseError}`);
          return [];
        }

        logger.info(`JiraAdapter: ✓ Obtenidos ${issues.length} issues de Jira`);

        // Convertir issues Jira a HistoricalRecordExtended
        const records: HistoricalRecordExtended[] = [];

        for (const issue of issues) {
          try {
            const record = this.jiraIssueToRecord(issue);
            if (record) {
              records.push(record);
            }
          } catch (error) {
            logger.warn(`JiraAdapter: Error convertiendo issue ${issue.key}: ${error}`);
          }
        }

        this.cache = records;
        logger.info(`JiraAdapter: ✓ ${records.length} registros convertidos exitosamente desde Jira`);
        return records;
      } catch (agentError) {
        logger.error(`JiraAdapter: Error durante búsqueda: ${agentError}`);
        logger.warn('JiraAdapter: Fallback a JSON local automáticamente.');
        return [];
      }
    } catch (error) {
      logger.error(`JiraAdapter: Error fetching records - ${error}`);
      return []; // Fallback graceful
    }
  }

  async queryBySimilarity(
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): Promise<HistoricalRecordExtended[]> {
    try {
      logger.debug(`JiraAdapter: Buscando similares - complejidad: ${complexity}, techs: ${technologies.join(', ')}`);

      const allRecords = await this.fetchRecords();
      const filtered = this.filterBySimilarity(allRecords, complexity, technologies);

      logger.info(`JiraAdapter: Encontrados ${filtered.length} registros similares`);
      return filtered;
    } catch (error) {
      logger.error(`JiraAdapter: Error en queryBySimilarity - ${error}`);
      return [];
    }
  }

  async queryByEpic(epicId: string): Promise<HistoricalRecordExtended[]> {
    try {
      logger.debug(`JiraAdapter: Buscando tareas de épica ${epicId}`);

      const jql = `parent = ${epicId} AND project = ${this.config.project}`;

      try {
        const response = await agentClient.jiraSearch(jql, this.config.maxResults || 100);

        let issues: JiraIssue[] = [];
        try {
          let data = response;
          if (typeof response === 'string') {
            data = JSON.parse(response);
          }
          if (typeof data === 'object' && data !== null) {
            issues = (data as any).issues || (Array.isArray(data) ? data : []);
          }
        } catch (parseError) {
          logger.warn(`JiraAdapter: Error parseando respuesta de queryByEpic: ${parseError}`);
        }

        const records = issues
          .map((issue) => {
            try {
              return this.jiraIssueToRecord(issue);
            } catch (error) {
              logger.warn(`JiraAdapter: Error convertiendo issue ${issue.key}: ${error}`);
              return null;
            }
          })
          .filter((r): r is HistoricalRecordExtended => r !== null);

        logger.info(`JiraAdapter: Encontrados ${records.length} registros por épica`);
        return records;
      } catch (agentError) {
        logger.warn('JiraAdapter: No se pudo acceder a Jira para queryByEpic. Fallback a vacío.');
        return [];
      }
    } catch (error) {
      logger.error(`JiraAdapter: Error en queryByEpic - ${error}`);
      return [];
    }
  }

  /**
   * Convierte un issue de Jira a HistoricalRecordExtended
   */
  private jiraIssueToRecord(issue: JiraIssue): HistoricalRecordExtended | null {
    try {
      const fields = issue.fields;

      // Extraer complejidad de Story Points
      const storyPoints = fields.customfield_10016 || 0;
      const complexity = this.storyPointsToComplexity(storyPoints);

      // Extraer horas reales de timetracking
      const timeSpentSeconds = fields.timetracking?.timeSpentSeconds || 0;
      const actualHours = Math.round((timeSpentSeconds / 3600) * 10) / 10; // Convertir a horas

      // Detectar Backend/Frontend de components
      const components = fields.components?.map((c) => c.name) || [];
      const isBackend = components.some((c) => c.toLowerCase().includes('backend'));
      const isFrontend = components.some((c) => c.toLowerCase().includes('frontend'));

      // Extraer tecnologías de descripción y labels
      const description = fields.description || '';
      const labels = fields.labels || [];
      const technologies = [...labels, ...this.extractTechnologies(description)];

      // Extraer funcionalidades de resumen
      const functionalities = [fields.summary];

      const record: HistoricalRecordExtended = {
        id: issue.key,
        projectId: this.config.project,
        projectType: fields.issuetype?.name || 'Task',
        scope: fields.summary,
        technologies,
        functionalities,
        complexity,
        estimatedHours: storyPoints * 8, // Asumiendo 8 horas por punto (ajustable)
        actualHours: actualHours > 0 ? actualHours : undefined,
        responsibleProfile: isFrontend ? 'frontend' : isBackend ? 'backend' : 'full-stack',
        date: fields.created,
        status: this.mapJiraStatus(fields.status?.name),
        notes: description,
        fictitious: false,
        sourceId: 'jira',
        connectionId: this.config.connectionId,
        jiraIssueKey: issue.key,
        jiraWorklog: timeSpentSeconds,
        storyPointsInitial: storyPoints,
        storyPointsFinal: storyPoints,
        backend: isBackend || !isFrontend,
        frontend: isFrontend,
      };

      return record;
    } catch (error) {
      logger.warn(`JiraAdapter: Error en jiraIssueToRecord: ${error}`);
      return null;
    }
  }

  /**
   * Convierte Story Points a complejidad
   */
  private storyPointsToComplexity(storyPoints: number): 'low' | 'medium' | 'high' {
    if (storyPoints <= 3) return 'low';
    if (storyPoints <= 8) return 'medium';
    return 'high';
  }

  /**
   * Extrae tecnologías del texto de descripción
   */
  private extractTechnologies(description: string): string[] {
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'nodejs',
      'python',
      'java',
      'go',
      'rust',
      'typescript',
      'javascript',
      'sql',
      'postgres',
      'mongodb',
      'redis',
      'docker',
      'kubernetes',
      'aws',
      'azure',
      'gcp',
      'graphql',
      'rest',
      'grpc',
    ];

    const found = new Set<string>();
    const lowerDesc = description.toLowerCase();

    for (const tech of techKeywords) {
      if (lowerDesc.includes(tech)) {
        found.add(tech);
      }
    }

    return Array.from(found);
  }

  /**
   * Mapea estado de Jira a estado interno
   */
  private mapJiraStatus(jiraStatus?: string): 'planned' | 'ongoing' | 'completed' | 'cancelled' {
    if (!jiraStatus) return 'completed';

    const status = jiraStatus.toLowerCase();
    if (status === 'done' || status === 'closed' || status === 'resolved') {
      return 'completed';
    }
    if (status === 'in progress') {
      return 'ongoing';
    }
    if (status === 'cancelled' || status === 'rejected') {
      return 'cancelled';
    }
    return 'planned';
  }
}

export function createJiraAdapter(config: {
  connectionId: string;
  project: string;
  maxResults?: number;
}) {
  return new JiraAdapter(config);
}
