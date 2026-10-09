export const config = {
  paths: {
    dataDir: './data',
    outputDir: './outputs',
    historicalEstimatesDir: './data/historical-estimates',
    briersDir: './data/briefs',
    estimationsOutputDir: './outputs/estimations',
    examplesDir: './examples',
  },
  estimation: {
    hoursPerDay: 8,
    contingency: 0.15,
  },
  validation: {
    minConfidence: 0.6,
    requiresReviewWhen: [
      'high_complexity',
      'unknown_technology',
      'critical_dependency',
      'tight_deadline',
    ],
  },

  // Configuración de fuentes históricas multi-MCP
  historicalDataSource: {
    // Por defecto usar archivos locales
    default: 'local-file',
    // Habilitar/deshabilitar fuentes disponibles
    enabled: ['local-file'], // Agregar 'fedpat-jira-prod' cuando esté disponible
  },

  // Configuración de selección de referencias
  referenceSelection: {
    // Modo: 'manual' (usuario selecciona) o 'automatic' (agente elige)
    mode: 'manual',
    // Filtros por defecto
    defaultFilters: {
      profile: 'both', // 'backend' | 'frontend' | 'both'
      minStoryPoints: 1,
      maxStoryPoints: 100,
      status: ['completed'], // solo completadas
    },
    // Rango de fechas por defecto (últimos 2 años)
    defaultDateRange: {
      days: 730,
    },
  },
};

export function validateConfig(): void {
  // No validation needed - Claude Agent SDK handles authentication via CLI
}
