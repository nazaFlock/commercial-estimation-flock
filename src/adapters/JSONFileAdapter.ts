import { BaseHistoricalReferenceProvider } from './HistoricalReferenceProvider.js';
import { HistoricalRecordExtended } from '../types.js';
import { historicalDataService } from '../services/historicalDataService.js';
import { logger } from '../utils/logger.js';

/**
 * Adapter para referencias históricas almacenadas en archivos JSON locales.
 * Utiliza historicalDataService existente.
 */
export class JSONFileAdapter extends BaseHistoricalReferenceProvider {
  name = 'Archivos JSON Locales';
  type: 'json' = 'json';

  async fetchRecords(): Promise<HistoricalRecordExtended[]> {
    try {
      logger.debug('JSONFileAdapter: Leyendo registros locales');
      const records = historicalDataService.getAllRecords();

      // Agregar metadatos de source
      const extended = records.map(record => ({
        ...record,
        sourceId: 'local-file',
        connectionId: 'file',
        source: 'file' as const,
      } as HistoricalRecordExtended));

      logger.info(`JSONFileAdapter: Obtenidos ${extended.length} registros`);
      return extended;
    } catch (error) {
      logger.error(`JSONFileAdapter: Error leyendo registros - ${error}`);
      throw error;
    }
  }

  async queryBySimilarity(
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): Promise<HistoricalRecordExtended[]> {
    try {
      logger.debug(`JSONFileAdapter: Buscando similares - complejidad: ${complexity}, techs: ${technologies.join(', ')}`);

      const allRecords = await this.fetchRecords();
      const filtered = this.filterBySimilarity(allRecords, complexity, technologies);

      logger.info(`JSONFileAdapter: Encontrados ${filtered.length} registros similares`);
      return filtered;
    } catch (error) {
      logger.error(`JSONFileAdapter: Error en queryBySimilarity - ${error}`);
      throw error;
    }
  }
}

export const jsonFileAdapter = new JSONFileAdapter();
