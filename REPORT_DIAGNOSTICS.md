# Diagnóstico Detallado - Problemas de Reporte Markdown

**Análisis de:** 8 problemas reportados en reporte generado  
**Fecha:** 2026-10-09  
**Status:** Diagnóstico completado, esperando aprobación para fixes

---

## Problema 1: Inconsistencia en Totales

### Síntoma
```
Totales por perfil (correcto):
- Mínimo: 2212 h
- Probable: 3100 h
- Máximo: 4544 h

Totales por módulo (incorrecto):
- Mínimo: 2298 h (diff: +86 h)
- Probable: 3258 h (diff: +158 h)
- Máximo: 4816 h (diff: +272 h)
```

### Causa Raíz
**Ubicación:** `src/services/reportGenerator.ts` línea ~35-47

```typescript
const modulesTable = report.estimation.moduleEffort
  .map(m => `| ${m.moduleName} | ${m.minHours} | ... |`)
  .join('\n');
```

**Problema:**
- `moduleEffort` se calcula INDEPENDIENTEMENTE en `effortEstimator.ts`
- `profileEffort` se calcula también INDEPENDIENTEMENTE
- NO hay reconciliación entre ambos
- Redondeos en `effortEstimator.ts` acumulan diferencias

**Dónde se crean moduleEffort y profileEffort:**
- `src/agents/effortEstimator.ts` líneas 33-55 (schema JSON esperado)
- Ambos se calculan sobre el mismo `tasks` array
- Pero sin garantía de suma consistente

### Solución Propuesta
1. Calcular solo `profileEffort` desde `tasks`
2. Derivar `moduleEffort` de `profileEffort` (reconciliación garantizada)
3. O viceversa: validar que ambos sumen igual antes de guardar
4. Tests que fallan si totales no coinciden

---

## Problema 2: Contradicciones Actividades Excluidas

### Síntoma
```
Exclusiones reportadas:
- Deployment and DevOps infrastructure setup
- Production monitoring and alerting

Pero en EstimatedTask:
- Existen tareas DevOps con estimación
- Se incluyen en totales
```

### Causa Raíz
**Ubicación:** `src/workflows/estimateProposal.ts` línea 81-88

```typescript
exclusions: [
  'Deployment and DevOps infrastructure setup',
  'Production monitoring and alerting',
  ...
],
```

**Problema:**
- Exclusiones son HARDCODED en workflow
- `effortEstimator.ts` NO recibe lista de exclusiones
- Estimador no sabe qué NO incluir
- Estimaciones y exclusiones desincronizadas

### Solución Propuesta
1. Pasar exclusiones a `effortEstimator` en schema
2. O: validar que tasks NO contengan excluidos
3. O: documentar que exclusiones son del analista técnico, no del estimador
4. Unificar fuente de verdad

---

## Problema 3: Jornadas vs. Días Calendar

### Síntoma
```
scenariosHours.likelyDays = 392 (impreso como "392 days")
```

**Cálculo:**
```typescript
// effortEstimator.ts línea 97
const hoursPerDay = config.estimation.hoursPerDay; // 8
likelyDays = Math.ceil(3100 / 8) = 388 days
```

**Problema:**
- Se imprime como "392 días calendar" pero es jornadas-persona
- No hay conversión a días reales considerando equipo
- Si equipo es 5 personas: son 78 días calendar, no 392

### Solución Propuesta
1. Renombrar a `likelyPersonDays` en tipo
2. Hacer conversión explícita: personDays / teamSize = calendarDays
3. O: reportar solo horas (más claro que días confusos)
4. Documentar unidad en reporte

---

## Problema 4: Confianza Inconsistente

### Síntoma
```
confidenceLevel: 'LOW' (enum text)
confidence percentage: 72% (computed)
```

### Causa Raíz
**Ubicación:** `src/workflows/estimateProposal.ts` línea 60-71

```typescript
let confidenceLevel: 'low' | 'medium' | 'high' = 'medium';
if (contextFactor >= 0.8 && risks <= 2) {
  confidenceLevel = 'high';
} else if (contextFactor < 0.6 || risks > 5) {
  confidenceLevel = 'low';
}

// Pero también:
confidenceJustification: `Confidence is ${confidenceLevel} based on...`
```

**Problema:**
- `confidenceLevel` es enum (low/medium/high)
- Pero 72% es calculado desde qué? No hay variable
- Posiblemente interpolado de contextFactor o históricos
- Inconsistencia: enum dice LOW pero porcentaje dice 72%

### Solución Propuesta
1. Definir fórmula clara: confidence% = f(factors)
2. Mapear % a enum (0-50: low, 50-75: medium, 75-100: high)
3. O: reportar solo %, no enum (más preciso)
4. Documentar cálculo en reporte

---

## Problema 5: Markdown Malformado

### Síntoma
```
[object Object]
Caracteres escapados: \\n \\t
Encabezados: ### ### (dobles)
```

### Causa Raíz
**Ubicación:** `src/services/reportGenerator.ts` línea ~80-120

```typescript
const risksTable = report.technicalAnalysis.risks
  .map(r => `| ${r.description} | ... |`)
  .join('\n');

// Pero si r.description contiene objeto:
`| ${JSON.stringify(r.description)} |` // → [object Object]

// Y escapes:
const markdown = `... ${JSON.stringify(data)} ...` // sin formato
```

**Problemas específicos:**
1. `JSON.stringify()` de objetos sin verificar tipo
2. Escapes de comillas en strings
3. Encabezados concatenados sin separador
4. No hay sanitización de contenido

### Solución Propuesta
1. Usar `JSON.stringify(x, null, 2)` solo para objetos legítimos
2. Sanitizar strings: escapar `|` en tablas, `#` en titles
3. Validar que antes de stringify, value es primitivo o array
4. Tests que fallan si contienen [object Object]

---

## Problema 6: Historical Comparison Incompleta

### Síntoma
```
## Historical Comparison

**Similar Projects Found:** 1

[Si 0: nota sobre falta de datos]
[Si >0: solo deviations y recommendations, sin metadata]
```

### Causa Raíz
**Ubicación:** `src/services/reportGenerator.ts` línea 153-168

```typescript
let markdown = `...
## Historical Comparison

**Similar Projects Found:** ${report.historicalComparison.similarProjects.length}

${
  report.historicalComparison.availableData
    ? `
### Deviations from Historical Patterns
...
`
    : '**Note:** Limited historical data available.'
}
...`;
```

**Problemas:**
1. Si encontró similares: NO dice cuáles son
2. NO dice período, equipo, contexto de referencias
3. NO explica por qué NO hay referencias (insuficiencia, calidad?)
4. NO muestra factores de calibración usados (si los hay)

### Solución Propuesta
1. Agregar tabla de referencias: Key | Similitud | Período | SP | Horas
2. Explicar causa si no hay: "Insuficientes historicos (n<5)" vs "Calidad baja"
3. Mostrar calibración: "Factor horas/SP Backend: 8.5 ± 2.1 (n=12)"
4. Tests que verifican que referencias se citan

---

## Problema 7: Motor Estadístico No Integrado

### Síntoma
```
NO aparece:
- Media / mediana de horas/SP
- Desviación estándar
- Coeficiente de variación
- Calibración histórica
```

### Causa Raíz
**Ubicación 1:** `src/workflows/estimateProposal.ts`

```typescript
// Invoca historicalValidator pero NO invoca projectionService
context.historicalComparison = await validateHistorical(
  context.technicalAnalysis,
  context.estimation,
  context,
  referenceSelection,
  connection,
);

// FALTA:
// context.statisticalAnalysis = await projectionService.projectProposal(...)
```

**Ubicación 2:** `src/services/reportGenerator.ts`

```typescript
// No genera sección estadística
// La función generateStatisticsSection() existe pero es muy básica
// y NO muestra calibración SP→Horas

function generateStatisticsSection(report: EstimationReport): string {
  // Solo imprime media/mediana si hay similares
  // No muestra: std, CV, percentiles, calibración
}
```

### Solución Propuesta
1. Invocar `projectionService` en workflow
2. Pasar resultado a contexto y reporte
3. Crear sección "Statistical Calibration" con:
   - Profile | Tasks | Total SP | Total Hours | Factor h/SP | Std | CV%
4. Crear sección "Projection Method" explicando modelo usado

---

## Problema 8: SP Estimados y Proyecciones Faltantes

### Síntoma
```
NO aparece:
- SP estimados por Backend vs Frontend
- Horas proyectadas usando calibración
- Escenarios bajo/central/alto del modelo
```

### Causa Raíz
**Ubicación 1:** Workflow no invoca projection

```typescript
// estimateProposal.ts
// Faltan estas líneas:
const projection = await projectionService.projectProposal(
  context.technicalAnalysis,
  records, // registros históricos
  referenceSelection?.source || 'file'
);
context.statisticalAnalysis = {
  ...projection,
  // Guardar en contexto
};
```

**Ubicación 2:** Reporte no incluye breakdown

```typescript
// reportGenerator.ts
// Faltan tabla de proyección:
// Módulo | Tarea | Perfil | SP | Factor | Horas
```

### Solución Propuesta
1. Invocar `projectionService` con tareas técnicas
2. Generar tabla de breakdown en reporte
3. Mostrar escenarios de proyección (bajo/central/alto)
4. Indicar si es "Estimación pura" vs "Calibrada histórica"

---

## 📊 Matriz de Causas

| Problema | Archivo | Función | Tipo | Severidad |
|----------|---------|---------|------|-----------|
| 1. Totales inconsistentes | effortEstimator.ts + reportGenerator.ts | Cálculo duplicado | Bug | 🔴 HIGH |
| 2. Contradicciones exclusiones | estimateProposal.ts + effortEstimator.ts | Desincronización | Design | 🟡 MEDIUM |
| 3. Jornadas vs días | effortEstimator.ts + reportGenerator.ts | Unidad confusa | Documentation | 🟡 MEDIUM |
| 4. Confianza inconsistente | estimateProposal.ts | Fórmula undefined | Bug | 🟡 MEDIUM |
| 5. Markdown malformado | reportGenerator.ts | JSON.stringify() | Bug | 🔴 HIGH |
| 6. Historical Comparison incompleta | reportGenerator.ts | generateMarkdown() | Feature | 🟡 MEDIUM |
| 7. Motor estadístico no integrado | estimateProposal.ts | No invoca service | Design | 🟡 MEDIUM |
| 8. SP y proyecciones faltantes | estimateProposal.ts + reportGenerator.ts | No integrado | Feature | 🟡 MEDIUM |

---

## ✅ Verificaciones Necesarias

Antes de aprobar fixes:

- [ ] Confirmar que todos los problemas están causados por lo que se describe
- [ ] Verificar que proyectionService está produciendo resultados correctos
- [ ] Confirmar que statisticsService funciona sin errores
- [ ] Revisar si hay otros cálculos de totales no identificados
- [ ] Validar estructura esperada de moduleEffort y profileEffort

---

## 📝 Propuesta de Orden de Fixes

1. **P1 (HIGH):** Problemas 1 y 5 - Totales e inconsistencias + Markdown
2. **P2 (HIGH):** Problema 7 - Integración del motor estadístico
3. **P3 (MEDIUM):** Problemas 6 y 8 - Históricos y proyecciones
4. **P4 (MEDIUM):** Problemas 2, 3, 4 - Claridad y consistencia

---

**Próximo paso:** Aguardando aprobación para proceder con fixes
