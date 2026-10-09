import { MCPConnection } from '../types.js';
import { IHistoricalReferenceProvider } from '../adapters/HistoricalReferenceProvider.js';
import { JSONFileAdapter } from '../adapters/JSONFileAdapter.js';
import { createJiraAdapter } from '../adapters/JiraAdapter.js';
import { logger } from '../utils/logger.js';

/**
 * Servicio para gestionar conexiones MCP y proveedores de referencias históricas.
 * Permite soportar múltiples fuentes de datos sin acoplamiento.
 */
class MCPConnectorService {
  private connectors: Map<string, MCPConnection> = new Map();
  private adapters: Map<string, IHistoricalReferenceProvider> = new Map();

  constructor() {
    this.initializeDefaultConnectors();
  }

  /**
   * Inicializa conectores por defecto (Jira + local file)
   */
  private initializeDefaultConnectors(): void {
    // Conector para Jira (via fedpat-jira MCP)
    const jiraConnection: MCPConnection = {
      id: 'jira',
      type: 'jira',
      name: 'Jira (fedpat-jira MCP)',
      config: {
        project: 'FLOCK', // Default project, can be overridden
      },
      status: 'available',
      tools: ['jira_search', 'jira_get_issue', 'jira_get_worklog', 'jira_get_changelog'],
    };

    // Conector para archivos JSON locales
    const localFileConnection: MCPConnection = {
      id: 'local-file',
      type: 'other',
      name: 'Archivos JSON Locales',
      config: {
        path: './data/historical-estimates',
      },
      status: 'available',
      tools: ['read', 'write', 'list'],
    };

    this.connectors.set('jira', jiraConnection);
    this.connectors.set('local-file', localFileConnection);
    this.adapters.set('local-file', new JSONFileAdapter());

    logger.info('MCPConnectorService: Conectores inicializados - jira, local-file');
  }

  /**
   * Registra una conexión MCP disponible
   */
  registerConnection(connection: MCPConnection): void {
    this.connectors.set(connection.id, connection);
    logger.info(`MCPConnectorService: Conexión registrada - ${connection.id}`);
  }

  /**
   * Obtiene una conexión por ID
   */
  getConnection(connectionId: string): MCPConnection | undefined {
    return this.connectors.get(connectionId);
  }

  /**
   * Lista todas las conexiones disponibles
   */
  listConnections(): MCPConnection[] {
    return Array.from(this.connectors.values());
  }

  /**
   * Lista solo conexiones disponibles
   */
  listAvailableConnections(): MCPConnection[] {
    return Array.from(this.connectors.values()).filter(c => c.status === 'available');
  }

  /**
   * Obtiene un adapter para una conexión
   */
  getAdapter(connectionId: string): IHistoricalReferenceProvider | undefined {
    let adapter = this.adapters.get(connectionId);

    if (!adapter) {
      const connection = this.connectors.get(connectionId);
      if (!connection) {
        logger.warn(`MCPConnectorService: Conexión no encontrada - ${connectionId}`);
        return undefined;
      }

      // Crear adapter según tipo de conexión
      if (connection.type === 'jira') {
        adapter = createJiraAdapter({
          connectionId,
          project: connection.config.project as string,
          maxResults: connection.config.maxResults as number | undefined,
        });
        this.adapters.set(connectionId, adapter);
      } else if (connection.type === 'other' && connectionId === 'local-file') {
        adapter = new JSONFileAdapter();
        this.adapters.set(connectionId, adapter);
      }
    }

    return adapter;
  }

  /**
   * Verifica si una conexión está disponible
   */
  isAvailable(connectionId: string): boolean {
    const connection = this.connectors.get(connectionId);
    return connection?.status === 'available';
  }

  /**
   * Registra un Jira MCP si está disponible
   * (Llamado por CLI cuando se detecta fedpat-jira)
   */
  registerJiraConnection(project: string, maxResults?: number): void {
    const jiraConnection: MCPConnection = {
      id: 'fedpat-jira-prod',
      type: 'jira',
      name: 'FedPat Jira',
      config: {
        project,
        maxResults: maxResults || 100,
      },
      status: 'available',
      tools: ['jira_search', 'jira_get_issue', 'jira_get_parent_issue', 'jira_search_by_epic', 'jira_get_changelog'],
    };

    this.registerConnection(jiraConnection);
    logger.info(`MCPConnectorService: Jira registrado para proyecto ${project}`);
  }
}

export const mcpConnectorService = new MCPConnectorService();
