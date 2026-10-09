# Motor Estadístico EstimadorFlock

## Descripción General

Motor estadístico determinístico para proyección de horas de desarrollo basada en Story Points históricos. Independiente de MCP, fuentes de datos y herramientas específicas.

## Arquitectura de 4 Servicios

### 1. **StatisticsService** (`statisticsService.ts`)

Servicio determinístico para cálculos estadísticos puros.

**Funcionalidades:**
- `calculateDescriptiveStats()` - Media, mediana, std, CV, percentiles
- `calculateRatioStatistics()` - Estadísticas de relación horas/SP
- `calculateAggregateRatio()` - Suma total horas ÷ suma total SP (no media de ratios)
- `calculateScenarios()` - Genera escenarios bajo/central/alto basados en dispersión
- `detectOutliers()` - Identifica outliers por Z-score
- `validateSPConsistency()` - Detecta cambios inconsistentes SP inicial vs final

**Sin dependencias de:**
- Nombres de empresas o proyectos Jira
- Estructuras específicas de MCPs
- APIs externas

### 2. **DataQualityValidator** (`dataQualityValidator.ts`)

Valida integridad y calidad de datos históricos.

**Reportes:**
- Completitud de datos (%)
- Problemas: horas faltantes, SP faltantes, perfil ausente
- Outliers detectados
- Calidad general: high/medium/low
- Recomendaciones automáticas

**Criterios:**
- ✅ Tareas completadas deben tener horas reales
- ✅ Detecta cambios SP > 2x
- ✅ Valida Backend/Frontend split
- ✅ Identifica datos inconsistentes

### 3. **SPToHoursCalibration** (`spToHoursCalibration.ts`)

Calcula factores de conversión SP → Horas.

**Modelos soportados:**
- **Proporcional** (siempre): `Horas = SP × factor`
- **Regresión Lineal** (si n ≥ 20): `Horas = β₀ + β₁ × SP`

**Calibración por perfil:**
- Backend
- Frontend

**Salida:**
```typescript
CalibrationFactor {
  profile: 'backend' | 'frontend'
  hoursPerSP: 9.23        // Ratio agregado
  meanRatio: 9.15         // Media de ratios individuales
  taskCount: 12
  totalSP: 120
  totalHours: 1107
  model: 'proportional' | 'linear_regression'
  dataQuality: 'high' | 'medium' | 'low'
  meanAbsoluteError?: 12.5   // Solo con regresión
  rootMeanSquaredError?: 18.7  // Solo con regresión
}
```

### 4. **ProjectionService** (`projectionService.ts`)

Orquesta la proyección de nuevas propuestas.

**Flujo:**
1. Validar datos históricos
2. Calibrar factores Backend y Frontend
3. Procesar componentes de propuesta técnica
4. Proyectar horas por tarea y perfil
5. Calcular escenarios (bajo/central/alto)
6. Generar warnings de calidad

**Salida:**
```typescript
ProjectionSummary {
  totalStoryPointsBackend: 21
  totalStoryPointsFrontend: 16
  hoursBackend: 193.83
  hoursFrontend: 128
  totalHours: 321.83
  scenarioLow: 280        // -12%
  scenarioCentral: 321.83 // Base
  scenarioHigh: 365       // +13%
  calibrationQuality: 'high'
  breakdown: [
    { module, task, profile, storyPoints, hoursProjected, ... }
  ]
}
```

## Integración con Existing Code

### Puntos de Integración

1. **historicalValidator.ts**
   - Ya acepta `ReferenceSelection` y `MCPConnection`
   - Puede pasar registros al motor estadístico

2. **reportGenerator.ts** (EXTENDIDO)
   - Nueva sección "Statistical Analysis"
   - Muestra media, mediana, std de datos históricos similares
   - Rango y coeficiente de variación

3. **effortEstimator.ts**
   - CLI puede usar calibración para validar estimaciones
   - Futuro: aplicar factores de ajuste

4. **projectionService** (NUEVO EN WORKFLOWS)
   - Puede invocarse desde `estimateProposal.ts` workflow
   - Enriquece el contexto con análisis estadístico

## Ejemplo de Uso

```typescript
import { statisticsService } from '../services/statisticsService.js';
import { dataQualityValidator } from '../services/dataQualityValidator.js';
import { spToHoursCalibration } from '../services/spToHoursCalibration.js';
import { projectionService } from '../services/projectionService.js';

// 1. Validar datos históricos
const quality = dataQualityValidator.validateDataset(records);
console.log(`Data Quality: ${quality.overallQuality}`);

// 2. Calibrar factores Backend y Frontend
const backendCal = spToHoursCalibration.calibrateProfile(records, 'backend', 'Jira MAART');
const frontendCal = spToHoursCalibration.calibrateProfile(records, 'frontend', 'Jira MAART');

// 3. Proyectar nuevas propuestas
const projection = projectionService.projectProposal(technicalAnalysis, records, 'Jira MAART');
console.log(`Total Hours: ${projection.totalHours} (${projection.scenarioLow} – ${projection.scenarioHigh})`);

// 4. Mostrar en reporte
report.statisticalAnalysis = {
  referenceSource: 'Jira MAART',
  recordsUsed: records.length,
  backendCalibration: { profile: 'backend', hoursPerSP: backendCal.hoursPerSP, ... },
  projectionSummary: { totalHours: projection.totalHours, ... }
};
```

## Datos Esperados

**HistoricalRecordExtended campos utilizados:**
```
✅ actualHours       - Horas reales (requerido para calibración)
✅ storyPointsInitial - SP originales (requerido para relación horas/SP)
✅ storyPointsFinal  - SP finales (validación, no para calibración)
✅ backend          - Clasificación Backend
✅ frontend         - Clasificación Frontend
✅ status           - Estado (preferir 'completed')
✅ date             - Fecha de registro
✅ technologies     - Stack tecnológico
✅ complexity       - Complejidad (low/medium/high)
```

**Campos opcionales pero útiles:**
```
⭐ teamId           - Equipo (segmentación)
⭐ jiraIssueKey    - Trazabilidad Jira
⭐ jiraWorklog      - Horas registradas (alternativa a actualHours)
⭐ clientId         - Cliente (segmentación)
```

## Validación y Tests

**Test files en `src/__tests__/`:**
- `statisticsService.test.ts` - Media, mediana, std, outliers
- `calibration.test.ts` - Factores SP→Horas, regresión
- `projection.test.ts` - Proyección de propuestas, escenarios

**Cobertura:**
- ✅ Cálculos con pocos datos (< 3)
- ✅ Cálculos con muchos datos (> 20)
- ✅ Detección de outliers
- ✅ Escenarios y dispersión
- ✅ Valores faltantes
- ✅ SP inconsistentes
- ✅ Regresión lineal

## Independencia de Fuentes

**El motor es agnóstico a:**
- ✅ Fedpat Jira MCP específico
- ✅ Nombres de proyectos Jira
- ✅ Claves de issues
- ✅ Estructura de tareas (épicas, subtareas)
- ✅ Equipo o cliente específico
- ✅ Excel vs CSV vs JSON vs Jira

**La normalización específica de cada fuente se resuelve en los adaptadores** (JiraAdapter, CSVAdapter, etc.)

## Limitaciones Conocidas

1. **Datos insuficientes (< 5 registros)**
   - Desviación estándar será alta
   - Regresión no confiable
   - Recomendación: usar calibración manual

2. **Alta variabilidad (CV > 80%)**
   - Escenarios tendrán rangos muy amplios
   - Considerar segmentación por equipo/proyecto
   - Investigar outliers

3. **Cambios en metodología**
   - Si equipo cambió de JIRA a Azure DevOps
   - Si cambió cómo se registran horas
   - Separar históricos por período

4. **Extrapolación**
   - Evitar proyecciones para SP fuera del rango histórico
   - Sistema advierte si se extrapola > 50%

## Próximos Pasos Sugeridos

1. **Integración con CLI**
   - Flag `--use-statistics` para habilitar motor
   - Flag `--calibration-manual` para sobrescribir factores

2. **Gráficos**
   - Dispersión SP vs Horas (Mermaid)
   - Distribución de ratios horas/SP
   - Comparación escenarios

3. **Segmentación Avanzada**
   - Por equipo, tecnología, período
   - Regresión con múltiples variables

4. **Feedback Loop**
   - Registrar estimaciones vs reales
   - Recalibrar periódicamente
   - Evolución de factores en el tiempo

---

**Versión:** 1.0  
**Fecha:** 2026-10-09  
**Estado:** ✅ Implementado y tested
