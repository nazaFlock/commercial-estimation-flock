import { HistoricalRecordExtended } from '../types.js';

/**
 * Interfaz común para proveedores de referencias históricas.
 * Permite integrar múltiples fuentes (Jira, Excel, CSV, etc.)
 * sin acoplamiento al motor de estimaciones.
 */
export interface IHistoricalReferenceProvider {
  name: string;
  type: 'jira' | 'azure' | 'file' | 'csv' | 'json';

  /**
   * Obtiene todos los registros históricos disponibles
   */
  fetchRecords(): Promise<HistoricalRecordExtended[]>;

  /**
   * Busca registros similares por complejidad y tecnologías
   */
  queryBySimilarity(
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): Promise<HistoricalRecordExtended[]>;

  /**
   * Busca registros por épica (solo para algunos proveedores)
   */
  queryByEpic?(epicId: string): Promise<HistoricalRecordExtended[]>;

  /**
   * Busca registros por equipo (Backend/Frontend)
   */
  queryByTeam?(teamId: string): Promise<HistoricalRecordExtended[]>;
}

/**
 * Clase base para implementar adaptadores específicos
 */
export abstract class BaseHistoricalReferenceProvider implements IHistoricalReferenceProvider {
  abstract name: string;
  abstract type: 'jira' | 'azure' | 'file' | 'csv' | 'json';

  abstract fetchRecords(): Promise<HistoricalRecordExtended[]>;

  abstract queryBySimilarity(
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): Promise<HistoricalRecordExtended[]>;

  /**
   * Calcula similitud entre tecnologías
   * Retorna true si hay overlap
   */
  protected hasTechnologyOverlap(recordTechs: string[], queryTechs: string[]): boolean {
    return queryTechs.some(tech => recordTechs.some(rt => rt.toLowerCase().includes(tech.toLowerCase()) || tech.toLowerCase().includes(rt.toLowerCase())));
  }

  /**
   * Filtra registros por complejidad y tecnologías
   */
  protected filterBySimilarity(
    records: HistoricalRecordExtended[],
    complexity: 'low' | 'medium' | 'high',
    technologies: string[],
  ): HistoricalRecordExtended[] {
    return records.filter(record => {
      const complexityMatch = record.complexity === complexity;
      const techMatch = this.hasTechnologyOverlap(record.technologies, technologies);
      return complexityMatch && techMatch;
    });
  }
}
