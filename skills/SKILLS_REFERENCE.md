# Skills Reference

Este documento describe los skills reutilizables que el sistema ofrece. Los skills son utilidades y patrones que pueden ser invocados desde múltiples agentes y workflows.

## Propósito de los Skills

- **Modularidad**: Lógica reutilizable sin duplicación
- **Consistencia**: Mismos criterios de análisis en todo el sistema
- **Extensibilidad**: Nuevos agents pueden usar skills existentes
- **Mantenibilidad**: Cambios centralizados en un único lugar

## Skills Implementados (Versión 0.1.0)

Actualmente, los skills están integrados como funciones TypeScript en los agentes. En futuras iteraciones, se separarán en archivos Markdown con instrucciones explícitas.

### 1. Brief Analysis Skill

**Responsabilidad**: Extraer información estructurada de un brief comercial

**Entrada**: Texto no estructurado de un brief

**Salida**: Objetivo del proyecto, scope, módulos, supuestos

**Usado por**: `functionalAnalyst`

**Criterios**:
- No inventar requerimientos no mencionados
- Identificar explícitamente ambigüedades
- Marcar supuestos claramente
- Nivel de confianza basado en claridad del brief

---

### 2. Functionality Decomposition Skill

**Responsabilidad**: Descomponer una funcionalidad en requisitos estimables

**Entrada**: Descripción de funcionalidad

**Salida**: Lista de requisitos concretos, identificación de dependencias

**Usado por**: `functionalAnalyst`

**Criterios**:
- Cada requisito debe ser independientemente estimable
- Identificar dependencias cross-module
- Marcar requisitos que requieren clarificación

---

### 3. Complexity Classification Skill

**Responsabilidad**: Clasificar complejidad técnica de componentes

**Entrada**: Descripción técnica del componente

**Salida**: Clasificación (low/medium/high) con justificación

**Usado por**: `technicalAnalyst`, `effortEstimator`

**Criterios**:
- **Baja**: Utiliza patrones conocidos, sin dependencias externas complejas
- **Media**: Requiere integración con sistemas externos o datos complejos
- **Alta**: Requiere investigación, algoritmos complejos, o múltiples integraciones

---

### 4. Effort Estimation Skill

**Responsabilidad**: Estimar horas de esfuerzo para una tarea

**Entrada**: Descripción de tarea, complejidad, dependencias

**Salida**: Min/Likely/Max horas con justificación

**Usado por**: `effortEstimator`

**Criterios**:
- **Baja complejidad**: 4-8 horas
- **Media complejidad**: 16-40 horas
- **Alta complejidad**: 64-160 horas
- Considerar: análisis, desarrollo, testing, integración
- Min: -25% de Likely
- Max: +35-50% de Likely (según complejidad)

---

### 5. Historical Project Matching Skill

**Responsabilidad**: Encontrar proyectos históricos similares

**Entrada**: Complejidad técnica, stack de tecnologías, tipo de proyecto

**Salida**: Lista de proyectos similares, estadísticas

**Usado por**: `historicalValidator`

**Criterios**:
- Similitud por: complejidad + tecnologías overlapping
- Priorizar proyectos completados (con actualHours)
- Descartar proyectos ficticios (usar solo para testing)
- Retornar promedio de esfuerzo, no certidumbre

---

### 6. Consistency Validation Skill

**Responsabilidad**: Validar consistencia entre totales parciales y totales

**Entrada**: Estimation result con tareas, módulos, perfiles

**Salida**: Lista de inconsistencias o confirmación de consistencia

**Usado por**: `effortEstimator` (internamente)

**Criterios**:
- Sum(task hours) ≈ Sum(module hours)
- Sum(task hours) ≈ Sum(profile hours)
- Min + Likely + Max coherentes en cada nivel

---

### 7. Report Generation Skill

**Responsabilidad**: Generar reportes en formatos múltiples

**Entrada**: EstimationReport completo

**Salida**: JSON y Markdown con estructura consistente

**Usado por**: `reportGenerator`

**Criterios**:
- JSON: Estructura normalizada, no duplicar datos
- Markdown: Legible por humanos, con tablas y secciones claras
- Incluir trazabilidad: requerimiento → tarea → estimación

---

## Uso de Skills en Código

### Desde un Agent

```typescript
import { estimateEffort } from '../skills/estimationSkill.js';

const taskEffort = await estimateEffort({
  name: 'Implement authentication',
  complexity: 'medium',
  dependencies: ['Database setup'],
});
```

### Desde un Service

```typescript
import { findSimilarProjects } from '../skills/historicalMatching.js';

const similar = await findSimilarProjects({
  complexity: 'high',
  technologies: ['React', 'Node.js', 'PostgreSQL'],
});
```

---

## Skills Planeados (Futuras Versiones)

### Skill: Risk Assessment
- Identificar riesgos técnicos y comerciales
- Cuantificar probabilidad e impacto
- Recomendar mitigaciones

### Skill: Dependency Analysis
- Mapear dependencias entre tareas
- Identificar camino crítico
- Detectar ciclos de dependencia

### Skill: Performance Estimation
- Estimar performance de arquitectura propuesta
- Identificar bottlenecks potenciales
- Recomendar optimizaciones

### Skill: Security Audit
- Revisar requerimientos de seguridad
- Identificar vulnerabilidades potenciales
- Recomendar controles

### Skill: Cost Calculation
- Convertir horas a costo
- Aplicar márgenes por perfil
- Generar presupuesto

### Skill: Scenario Planning
- Modelar "what-if" scenarios
- Estimar impacto de cambios
- Generar comparativas

---

## Mejores Prácticas

### Crear un Nuevo Skill

1. **Definir responsabilidad única**: Un skill = una cosa bien hecha
2. **Documentar entrada/salida**: Tipos TypeScript claros
3. **Incluir justificación**: Por qué se toma cada decisión
4. **Permitir override**: Parámetros para customizar comportamiento
5. **Testear independientemente**: Unit tests para skill core logic

### Usar un Skill en Múltiples Lugares

```typescript
// skill.ts
export async function classify(input: ComponentDescription): Promise<Complexity> {
  // Lógica centralizada
}

// agent1.ts
const complexity = await classify(component);

// agent2.ts
const complexity = await classify(component);  // Mismo comportamiento
```

### Versionar Skills

Cuando cambies un skill, considera impacto en:
- Historiales de proyectos pasados
- Reportes generados
- Comparaciones históricas

Documenta cambios en CHANGELOG.

---

## Integración con Workflows Futuros

Conforme el proyecto crece, los skills permitirán:

1. **Ejecutar workflows en paralelo**: Múltiples agents usando mismos skills
2. **Reutilización de resultados**: Cache de análisis similares
3. **Incrementalidad**: Retomar estimación desde etapa intermedia
4. **Validación humana**: Parar en puntos específicos para revisión
5. **Aprendizaje**: Incorporar feedback real en cálculos futuros

---

**Versión de referencia**: 0.1.0  
**Último update**: 2026-10-09
