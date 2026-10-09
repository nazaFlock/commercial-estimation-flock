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

      const prompt = `Invoca jira_search con estos parámetros exactos:
- jql: "${jql}"
- max_results: ${maxResults}

Retorna SOLO el resultado JSON de la búsqueda, sin explicaciones adicionales.`;

      const q = query({ prompt });

      let finalResult: unknown = null;

      for await (const message of q) {
        const msg = message as any;
        logger.debug(`AgentClient: Message type: ${msg.type}`);

        // Capturar tool_result (resultado de la herramienta invocada)
        if (msg.type === 'tool_result') {
          logger.info(`AgentClient: jira_search invocado exitosamente`);
          if (msg.result) {
            finalResult = msg.result;
          }
        }
      }

      if (!finalResult) {
        logger.warn('AgentClient: No result from jiraSearch');
        return null;
      }

      logger.info(`AgentClient: jiraSearch result obtained`);
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

      const prompt = `Invoca jira_get_issue con estos parámetros:
- issue_key_or_id: "${issueKey}"
- detail_level: "${detailLevel}"

Retorna SOLO el resultado JSON del issue, sin explicaciones.`;

      const q = query({ prompt });

      let finalResult: unknown = null;

      for await (const message of q) {
        const msg = message as any;
        logger.debug(`AgentClient: Message type: ${msg.type}`);

        if (msg.type === 'tool_result') {
          logger.info(`AgentClient: jira_get_issue invocado exitosamente`);
          if (msg.result) {
            finalResult = msg.result;
          }
        }
      }

      if (!finalResult) {
        logger.warn('AgentClient: No result from jiraGetIssue');
        return null;
      }

      return finalResult;
    } catch (error) {
      logger.error(`AgentClient.jiraGetIssue failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }


  /**
   * Invoca jira_get_worklog para obtener registros de tiempo
   */
  async jiraGetWorklog(issueKey: string): Promise<unknown> {
    try {
      logger.info(`AgentClient: jiraGetWorklog - Key: ${issueKey}`);

      const prompt = `Invoca jira_get_worklog para obtener registros de tiempo del issue: "${issueKey}"
Retorna SOLO el resultado JSON sin explicaciones.`;

      const q = query({ prompt });

      let finalResult: unknown = null;

      for await (const message of q) {
        const msg = message as any;

        if (msg.type === 'tool_result') {
          logger.info(`AgentClient: jira_get_worklog invocado exitosamente`);
          if (msg.result) {
            finalResult = msg.result;
          }
        }
      }

      if (!finalResult) {
        logger.warn('AgentClient: No result from jiraGetWorklog');
        return null;
      }

      return finalResult;
    } catch (error) {
      logger.error(`AgentClient.jiraGetWorklog failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  }
}

export const agentClient = new AgentClient();
