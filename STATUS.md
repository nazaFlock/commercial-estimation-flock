# Estado del Proyecto - EstimadorFlock

**Última actualización:** 2026-10-09  
**Versión:** 1.0-beta

---

## ✅ Completado

### Arquitectura Multi-MCP
- ✅ Diseño e implementación de adapter pattern
- ✅ `HistoricalReferenceProvider` interfaz común
- ✅ `JSONFileAdapter` (producción)
- ✅ `JiraAdapter` estructura (Agent SDK limitación)
- ✅ `MCPConnectorService` - gestión de conexiones
- ✅ Backward compatible 100%

### Motor Estadístico
- ✅ `StatisticsService` - Media, mediana, std, percentiles, outliers
- ✅ `DataQualityValidator` - Integridad de datos, recomendaciones
- ✅ `SPToHoursCalibration` - Factores horas/SP, modelos
- ✅ `ProjectionService` - Orquestación, breakdown
- ✅ 19 test cases (statisticsService, calibration, projection)
- ✅ Independencia de fuentes (agnóstico a Jira/CSV/JSON)

### CLI & Configuración
- ✅ Nuevos flags: `--data-source`, `--references`, `--jira-project`
- ✅ `config.ts` extendido con historicalDataSource y referenceSelection
- ✅ Soporte fallback automático a JSON

### Documentación
- ✅ `STATISTICAL_ENGINE.md` - Guía técnica completa
- ✅ `MULTI_MCP_ARCHITECTURE.md` - Arquitectura multi-MCP
- ✅ `IMPLEMENTATION_SUMMARY.md` - Resumen de cambios

---

## ⚠️ Limitaciones Conocidas

### 1. **Invocación de Jira MCP - Agent SDK Limitación**

**Estado:** 🔷 Arquitectura lista, Agent SDK limitación

**Problema:**
- `jira_search` y otras herramientas están disponibles en sesión
- Pero Agent SDK no las invoca correctamente desde el código TypeScript
- Claude responde en texto natural en lugar de ejecutar la herramienta

**Causa raíz:**
- No es problema de disponibilidad (herramientas confirmadas disponibles)
- Parece ser problema de cómo Agent SDK invoca herramientas en contexto programático
- Posibles causas: parámetros options incompletos, endpoint incorrecto, contexto diferente

**Workaround actual:**
- Sistema fallback automático a JSON local
- Estimation continúa sin interrupciones
- Log claro indicando por qué Jira no funcionó

**Próximo paso:**
- Investigar alternate invocation methods del Agent SDK
- O usar approach intermedio: convertir Jira data a JSON primero

---

## 🔴 Problemas Reportados en Reporte Markdown

**Usuario reportó 8 problemas en reporte generado:**

### 1. **Inconsistencia en Totales**
- Totales por perfil: correcto
- Totales por módulo: discrepancia de ~100-300 horas en min/likely/max
- **Causa probable:** Doble conteo o cálculo independiente sin reconciliación

### 2. **Contradicciones Actividades Excluidas**
- Se excluyen DevOps/Infraestructura pero se estiman tareas de ese tipo
- **Causa probable:** Validación inconsistente en estimador

### 3. **Jornadas vs. Días Calendar**
- Se presentan jornadas-persona como días calendar
- **Causa probable:** `config.estimation.hoursPerDay` = 8 pero falta conversión clara

### 4. **Confianza Inconsistente**
- Nivel texto: "LOW" pero porcentaje: "72%"
- **Causa probable:** Lógica de clasificación incorrecta

### 5. **Markdown Malformado**
- Caracteres escapados incorrectamente
- Encabezados mal formateados
- Objetos como `[object Object]`
- **Causa probable:** JSON.stringify() en template sin formato

### 6. **Historical Comparison Incompleta**
- No muestra referencias utilizadas
- No explica por qué no existen históricos
- **Causa probable:** `reportGenerator.ts` no implementa esta sección

### 7. **Motor Estadístico No Integrado**
- Nueva sección estadística no aparece
- **Causa probable:** `reportGenerator.ts` no conecta estadísticas

### 8. **SP Estimados y Proyecciones Faltantes**
- No aparecen SP por perfil
- No aparecen horas proyectadas del modelo estadístico
- **Causa probable:** Projection service no invocado en workflow

---

## 🔍 Archivos Involucrados

### **Generación del Reporte** (Top Priority)
```
src/services/reportGenerator.ts          [MEJORAR]
  ├── generateMarkdown()                  [REFACTOR]
  └── generateStatisticsSection()         [PARCIAL]

src/workflows/estimateProposal.ts        [INTEGRAR]
  └── No invoca projectionService

src/services/projectionService.ts        [NO INTEGRADO]
  └── Listo pero no se usa
```

### **Cálculo de Totales**
```
src/agents/effortEstimator.ts            [VERIFICAR]
  ├── moduleEffort calculation
  ├── profileEffort calculation
  └── scenariosHours calculation

src/services/reportGenerator.ts          [VERIFICAR]
  └── Imprime totales sin validación cruzada
```

### **Validaciones**
```
src/services/dataQualityValidator.ts     [NO INTEGRADO]
  └── Listo pero no se ejecuta antes del reporte
```

---

## 📋 Tareas Pendientes (Ordenadas por Impacto)

### P1: Reparar Reporte Markdown
- [ ] Refactorizar `reportGenerator.ts` para evitar doble conteo
- [ ] Integrar motor estadístico en workflow
- [ ] Validar consistencia totales vs. breakdown
- [ ] Corregir formato Markdown (JSON.stringify sin escapes)
- [ ] Agregar sección "Método de Estimación" con trazabilidad

### P2: Integrar Estadísticas
- [ ] Invocar `projectionService` en `estimateProposal.ts`
- [ ] Pasar resultados a `reportGenerator.ts`
- [ ] Mostrar SP por perfil y horas proyectadas
- [ ] Mostrar calibración utilizada

### P3: Validaciones Pre-Reporte
- [ ] Ejecutar `dataQualityValidator` antes de generar reporte
- [ ] Validar consistencia totales
- [ ] Advertir si históricos insuficientes
- [ ] Validar confianza vs. datos disponibles

### P4: Mejorar Claridad
- [ ] Diferenciar jornadas-persona de días calendar
- [ ] Unificar cálculo de confianza
- [ ] Explicar por qué no hay históricos
- [ ] Documentar supuestos utilizados

---

## 🧪 Testing

### Cobertura Actual
- ✅ StatisticsService: 8 tests
- ✅ Calibration: 6 tests
- ✅ Projection: 5 tests
- ❌ ReportGenerator: 0 tests (inconsistencias no detectadas)
- ❌ Totals reconciliation: 0 tests

### Tests Necesarios
- [ ] Test: módulo min/max coincide con suma de tareas
- [ ] Test: totales por perfil coinciden con breakdown
- [ ] Test: Markdown válido (sin escapes incorrectos)
- [ ] Test: Confianza consistente entre texto y porcentaje
- [ ] Test: No hay [object Object] en output

---

## 📌 Notas Importantes

1. **No inventar datos**: Si no hay históricos suficientes, reportar explícitamente
2. **Trazabilidad**: Cada número debe tener origen (estimador, histórico, calibración)
3. **Validación pre-reporte**: No generar Markdown inconsistente
4. **Formato limpio**: Markdown debe ser parseable, sin escapes raros
5. **Motor estadístico listo**: Ya está implementado, solo falta conectarlo

---

## ✨ Próximas Versiones

**v1.1** (Post-Beta)
- Reparar reporte Markdown (ver tareas P1-P4 arriba)
- Integrar validaciones pre-reporte
- Tests de consistencia

**v1.2** (Future)
- CSV y Excel adapters
- Segmentación avanzada (por equipo, tecnología, período)
- Gráficos Mermaid en reporte
- Feedback loop y recalibración automática

**v2.0** (Long-term)
- Web UI para editar estimaciones
- Base de datos vs. JSON
- Dashboard de evolución de factores
- Integración con herramientas de gestión

---

**Responsable:** EstimadorFlock Development Team  
**Estado General:** Beta - Funcional pero con problemas de reporte conocidos
