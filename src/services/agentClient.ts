import { query } from '@anthropic-ai/claude-agent-sdk';
import { logger } from '../utils/logger.js';

/**
 * Cliente para invocar herramientas MCP a través del Claude Agent SDK
 * Especialmente diseñado para queries que requieren herramientas específicas
 */
class AgentClient {
  /**
   * Invoca jira_search directamente
   */
  async jiraSearch(jql: string, maxResults: number = 100): Promise<unknown> {
    try {
      logger.info(`AgentClient: jiraSearch - JQL: ${jql}, maxResults: ${maxResults}`);

      // Prompt simple y directo que confía en que Claude invoque la herramienta
      const prompt = `Usa la herramienta jira_search para buscar issues en Jira.

Parámetros:
- jql: "${jql}"
- max_results: ${maxResults}

Retorna exactamente el resultado de la búsqueda sin modificaciones.`;

      // Usar query con herramienta específica
      const q = query({
        prompt,
        options: {
          systemPrompt:
            'Eres un asistente que tiene acceso a herramientas Jira. Cuando se te pida buscar issues, ' +
            'usa jira_search con los parámetros proporcionados. Devuelve exactamente lo que la herramienta devuelve.',
          tools: ['jira_search'],
          allowedTools: ['jira_search'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      let finalResult: unknown = '';

      for await (const message of q) {
        const msg = message as any;
        logger.debug(`AgentClient: Message type: ${msg.type}`);

        // Capturar resultado de la herramienta si está disponible
        if (msg.type === 'tool_result' || msg.toolName) {
          logger.info(`AgentClient: Tool result received: ${msg.toolName}`);
          if (msg.result) {
            finalResult = msg.result;
          }
        }

        // Capturar resultado final de Claude
        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            // Si no tenemos resultado de herramienta, usar resultado de Claude
            if (finalResult === '') {
              finalResult = msg.result;
            }
            logger.info('AgentClient: jiraSearch completed successfully');
          } else {
            throw new Error(`Query failed (${msg.subtype}): ${msg.errors?.join('; ') ?? 'unknown error'}`);
          }
        }
      }

      if (!finalResult) {
        logger.warn('AgentClient: No result from jiraSearch');
        return {};
      }

      logger.debug(`AgentClient: jiraSearch result type: ${typeof finalResult}`);
      return finalResult;
    } catch (error) {
      logger.error(`AgentClient.jiraSearch failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }

  /**
   * Invoca jira_get_issue para obtener detalles completos
   */
  async jiraGetIssue(issueKey: string, detailLevel: 'summary' | 'full' = 'full'): Promise<unknown> {
    try {
      logger.info(`AgentClient: jiraGetIssue - Key: ${issueKey}, DetailLevel: ${detailLevel}`);

      const prompt = `Usa jira_get_issue para obtener detalles del issue.

Parámetros:
- issue_key_or_id: "${issueKey}"
- detail_level: "${detailLevel}"

Retorna el resultado exacto de la herramienta.`;

      const q = query({
        prompt,
        options: {
          systemPrompt: 'Tienes acceso a jira_get_issue. Úsalo para obtener detalles de issues. Devuelve exactamente lo que devuelve la herramienta.',
          tools: ['jira_get_issue'],
          allowedTools: ['jira_get_issue'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      let finalResult: unknown = '';

      for await (const message of q) {
        const msg = message as any;

        if (msg.type === 'tool_result' || msg.toolName) {
          logger.info(`AgentClient: Tool result received: ${msg.toolName}`);
          if (msg.result) {
            finalResult = msg.result;
          }
        }

        if (msg.type === 'result') {
          if (msg.subtype === 'success') {
            if (finalResult === '') {
              finalResult = msg.result;
            }
            logger.info('AgentClient: jiraGetIssue completed successfully');
          } else {
            throw new Error(`Query failed (${msg.subtype}): ${msg.errors?.join('; ')}`);
          }
        }
      }

      return finalResult;
    } catch (error) {
      logger.error(`AgentClient.jiraGetIssue failed: ${error}`);
      throw error;
    }
  }

  /**
   * Invoca jira_get_worklog para obtener registros de tiempo
   */
  async jiraGetWorklog(issueKey: string): Promise<unknown> {
    try {
      logger.info(`AgentClient: jiraGetWorklog - Key: ${issueKey}`);

      const prompt = `Usa jira_get_worklog para obtener registros de tiempo del issue "${issueKey}".
Retorna exactamente el resultado.`;

      const q = query({
        prompt,
        options: {
          systemPrompt: 'Usa jira_get_worklog para obtener tiempos registrados en issues.',
          tools: ['jira_get_worklog'],
          allowedTools: ['jira_get_worklog'],
          permissionMode: 'bypassPermissions',
          allowDangerouslySkipPermissions: true,
        },
      });

      let finalResult: unknown = '';

      for await (const message of q) {
        const msg = message as any;

        if (msg.type === 'tool_result' || msg.toolName) {
          if (msg.result) {
            finalResult = msg.result;
          }
        }

        if (msg.type === 'result' && msg.subtype === 'success') {
          if (finalResult === '') {
            finalResult = msg.result;
          }
        }
      }

      return finalResult;
    } catch (error) {
      logger.error(`AgentClient.jiraGetWorklog failed: ${error}`);
      throw error;
    }
  }
}

export const agentClient = new AgentClient();
