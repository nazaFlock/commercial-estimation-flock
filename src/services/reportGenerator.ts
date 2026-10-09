import { EstimationReport } from '../types.js';
import { writeJsonFile, writeTextFile } from '../utils/fileUtils.js';
import { config } from '../config.js';
import * as path from 'path';
import { logger } from '../utils/logger.js';

export function generateReports(report: EstimationReport): {
  jsonPath: string;
  markdownPath: string;
} {
  const reportDir = path.join(
    config.paths.estimationsOutputDir,
    report.briefId,
  );
  const timestamp = new Date().toISOString().split('T')[0];
  const reportName = `${report.id}-${timestamp}`;

  const jsonPath = path.join(reportDir, `${reportName}.json`);
  const markdownPath = path.join(reportDir, `${reportName}.md`);

  // Reconcile totals before generating reports
  reconcileTotals(report);

  // Write JSON
  writeJsonFile(jsonPath, report);
  logger.info(`Report JSON written to: ${jsonPath}`);

  // Write Markdown
  const markdown = generateMarkdown(report);
  writeTextFile(markdownPath, markdown);
  logger.info(`Report Markdown written to: ${markdownPath}`);

  return { jsonPath, markdownPath };
}

function reconcileTotals(report: EstimationReport): void {
  const tasks = report.estimation.tasks;
  const scenarios = report.estimation.scenariosHours;

  // Calculate moduleEffort from tasks to ensure consistency
  const moduleMap = new Map<string, { minHours: number; likelyHours: number; maxHours: number }>();
  const profileMap = new Map<string, { minHours: number; likelyHours: number; maxHours: number; taskCount: number }>();

  for (const task of tasks) {
    // Sum by module
    if (!moduleMap.has(task.module)) {
      moduleMap.set(task.module, { minHours: 0, likelyHours: 0, maxHours: 0 });
    }
    const mod = moduleMap.get(task.module)!;
    mod.minHours += task.minHours;
    mod.likelyHours += task.likelyHours;
    mod.maxHours += task.maxHours;

    // Sum by profile
    if (!profileMap.has(task.profile)) {
      profileMap.set(task.profile, { minHours: 0, likelyHours: 0, maxHours: 0, taskCount: 0 });
    }
    const prof = profileMap.get(task.profile)!;
    prof.minHours += task.minHours;
    prof.likelyHours += task.likelyHours;
    prof.maxHours += task.maxHours;
    prof.taskCount += 1;
  }

  // Replace moduleEffort with reconciled values
  report.estimation.moduleEffort = Array.from(moduleMap.entries()).map(([name, effort]) => ({
    moduleId: name.toLowerCase().replace(/\s+/g, '-'),
    moduleName: name,
    ...effort,
  }));

  // Replace profileEffort with reconciled values
  report.estimation.profileEffort = Array.from(profileMap.entries()).map(([profile, effort]) => ({
    profile,
    ...effort,
  }));

  // Validate scenario totals match sum of profiles
  const totalMinFromProfiles = Array.from(profileMap.values()).reduce((sum, p) => sum + p.minHours, 0);
  const totalLikelyFromProfiles = Array.from(profileMap.values()).reduce((sum, p) => sum + p.likelyHours, 0);
  const totalMaxFromProfiles = Array.from(profileMap.values()).reduce((sum, p) => sum + p.maxHours, 0);

  if (Math.abs(totalMinFromProfiles - scenarios.minHours) > 1) {
    logger.warn(
      `Total reconciliation: scenario minHours (${scenarios.minHours}) differs from profile sum (${totalMinFromProfiles}). Using profile sum.`,
    );
    scenarios.minHours = Math.round(totalMinFromProfiles);
  }
  if (Math.abs(totalLikelyFromProfiles - scenarios.likelyHours) > 1) {
    logger.warn(
      `Total reconciliation: scenario likelyHours (${scenarios.likelyHours}) differs from profile sum (${totalLikelyFromProfiles}). Using profile sum.`,
    );
    scenarios.likelyHours = Math.round(totalLikelyFromProfiles);
  }
  if (Math.abs(totalMaxFromProfiles - scenarios.maxHours) > 1) {
    logger.warn(
      `Total reconciliation: scenario maxHours (${scenarios.maxHours}) differs from profile sum (${totalMaxFromProfiles}). Using profile sum.`,
    );
    scenarios.maxHours = Math.round(totalMaxFromProfiles);
  }

  logger.info(`Totals reconciled: ${scenarios.minHours}/${scenarios.likelyHours}/${scenarios.maxHours} hours`);
}

function sanitizeMarkdown(text: string): string {
  if (!text) return '';
  if (typeof text !== 'string') return String(text);
  return text
    .replace(/\|/g, '\\|') // Escape pipes in table content
    .replace(/\n/g, ' ') // Convert newlines to spaces in table cells
    .replace(/\t/g, ' ') // Convert tabs to spaces
    .replace(/\\/g, '\\\\'); // Escape backslashes
}

function extractConfidencePercentage(justification: string): number {
  const match = justification.match(/\((\d+)%\)/);
  return match ? parseInt(match[1], 10) : 50;
}

function generateMarkdown(report: EstimationReport): string {
  const scenarios = report.estimation.scenariosHours;
  const profilesTable = report.estimation.profileEffort
    .map(
      (p) =>
        `| ${sanitizeMarkdown(p.profile)} | ${p.minHours} | ${p.likelyHours} | ${p.maxHours} | ${p.taskCount} |`,
    )
    .join('\n');

  const modulesTable = report.estimation.moduleEffort
    .map(
      (m) =>
        `| ${sanitizeMarkdown(m.moduleName)} | ${m.minHours} | ${m.likelyHours} | ${m.maxHours} |`,
    )
    .join('\n');

  const risksTable = report.technicalAnalysis.risks
    .map(
      (r) =>
        `| ${sanitizeMarkdown(r.description)} | ${sanitizeMarkdown(r.likelihood)} | ${sanitizeMarkdown(r.impact)} | ${sanitizeMarkdown(r.mitigation || 'TBD')} |`,
    )
    .join('\n');

  // Estadísticas de referencias (si disponibles)
  const statisticsSection = generateStatisticsSection(report);

  // Generate effort distribution charts
  const backendHours = report.estimation.profileEffort.find(p => p.profile === 'backend')?.likelyHours || 0;
  const frontendHours = report.estimation.profileEffort.find(p => p.profile === 'frontend')?.likelyHours || 0;
  const qaHours = report.estimation.profileEffort.find(p => p.profile === 'qa')?.likelyHours || 0;
  const devopsHours = report.estimation.profileEffort.find(p => p.profile === 'devops')?.likelyHours || 0;
  const otherHours = report.estimation.profileEffort.find(p => p.profile === 'architect')?.likelyHours || 0;
  const totalHours = report.estimation.scenariosHours.likelyHours;

  let markdown = `# Estimation Report

**Project:** ${sanitizeMarkdown(report.briefId)}
**Generated:** ${new Date(report.generatedAt).toLocaleString()}
**Confidence Level:** ${report.confidenceLevel.toUpperCase()} (${extractConfidencePercentage(report.confidenceJustification)}%)

## Executive Summary

${sanitizeMarkdown(report.executiveSummary)}

### Confidence Justification
${sanitizeMarkdown(report.confidenceJustification)}

## Descripción General del Esfuerzo

| Escenario | Horas | Días de Trabajo |
|----------|-------|-----------------|
| **Mínimo** | ${scenarios.minHours} h | ≈${scenarios.minDays} |
| **Probable** | ${scenarios.likelyHours} h | ≈${scenarios.likelyDays} |
| **Máximo** | ${scenarios.maxHours} h | ≈${scenarios.maxDays} |

**Nota:** Los días de trabajo representan jornadas-persona (basado en ${config.estimation.hoursPerDay} horas/día). La duración real en días calendario depende del tamaño del equipo y disponibilidad.

## Esfuerzo por Perfil

| Perfil | Horas Mín | Horas Probables | Horas Máx | Tareas |
|--------|-----------|-----------------|-----------|--------|
${profilesTable}

## Esfuerzo por Módulo

| Módulo | Horas Mín | Horas Probables | Horas Máx |
|--------|-----------|-----------------|-----------|
${modulesTable}

## Análisis Funcional

### Objetivo del Proyecto
${sanitizeMarkdown(report.functionalAnalysis.projectObjective)}

### Alcance
${sanitizeMarkdown(report.functionalAnalysis.scope)}

### Módulos y Funcionalidades
${report.functionalAnalysis.modules
  .map(
    (m) => `
#### ${sanitizeMarkdown(m.name)}
- **Description:** ${sanitizeMarkdown(m.description)}
- **Priority:** ${sanitizeMarkdown(m.priority || 'Not specified')}
- **Functionalities:** ${m.functionalities.length}
  ${m.functionalities.map((f) => `- ${sanitizeMarkdown(f.name)}: ${sanitizeMarkdown(f.description)}`).join('\n  ')}
`,
  )
  .join('\n')}

### Brechas y Supuestos Identificados
- **Nivel de Confianza:** ${(report.functionalAnalysis.confidenceLevel * 100).toFixed(0)}%
- **Brechas:** ${report.functionalAnalysis.gaps.length > 0 ? report.functionalAnalysis.gaps.map(g => sanitizeMarkdown(g)).join('; ') : 'Ninguna identificada'}
- **Supuestos:** ${report.functionalAnalysis.assumptions.length > 0 ? report.functionalAnalysis.assumptions.map(a => sanitizeMarkdown(a)).join('; ') : 'Ninguno'}

## Análisis Técnico

### Arquitectura
${sanitizeMarkdown(report.technicalAnalysis.architecture)}

### Stack Tecnológico
${report.technicalAnalysis.technologyStack
  .map((t) => `- **${sanitizeMarkdown(t.name)}** (${sanitizeMarkdown(t.category)}): ${sanitizeMarkdown(t.justification || 'Sin justificación')}`)
  .join('\n')}

### Componentes Técnicos
${report.technicalAnalysis.components
  .map(
    (c) => `
#### ${sanitizeMarkdown(c.name)}
- **Tipo:** ${sanitizeMarkdown(c.type)}
- **Complejidad:** ${sanitizeMarkdown(c.complexity)}
- **Descripción:** ${sanitizeMarkdown(c.description)}
- **Justificación:** ${sanitizeMarkdown(c.rationale)}
- **Tareas:** ${c.tasks.length}
`,
  )
  .join('\n')}

### Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
${risksTable}

## Desglose de Estimación

### Criterios de Estimación
${sanitizeMarkdown(report.estimation.criteria)}

### Desglose Detallado de Tareas

| # | Nombre de Tarea | Módulo | Perfil | Complejidad | Horas Mín | Probables | Horas Máx | Justificación |
|----|-----------------|--------|--------|-------------|-----------|-----------|-----------|---------------|
${report.estimation.tasks
  .map(
    (t, idx) =>
      `| ${idx + 1} | ${sanitizeMarkdown(t.name)} | ${sanitizeMarkdown(t.module)} | ${sanitizeMarkdown(t.profile)} | ${sanitizeMarkdown(t.complexity)} | ${t.minHours} | ${t.likelyHours} | ${t.maxHours} | ${sanitizeMarkdown((t.justification || 'N/A').substring(0, 50))} |`,
  )
  .join('\n')}

### Tareas Que Requieren Validación
${report.estimation.validationFlags.length > 0 ? report.estimation.validationFlags.map((f) => `- ${sanitizeMarkdown(f)}`).join('\n') : 'Ninguna identificada'}

## Comparación Histórica

**Proyectos Similares Encontrados:** ${report.historicalComparison.similarProjects.length}

${
  report.historicalComparison.similarProjects.length > 0
    ? `
### Proyectos de Referencia

| ID Proyecto | Tipo | Complejidad | Horas Est. | Horas Reales | Estado |
|----------|------|------------|-----------|--------------|--------|
${report.historicalComparison.similarProjects
  .map(
    (p) =>
      `| ${sanitizeMarkdown(p.projectId)} | ${sanitizeMarkdown(p.projectType)} | ${sanitizeMarkdown(p.complexity)} | ${p.estimatedHours} | ${p.actualHours ? p.actualHours.toFixed(0) : 'Por definir'} | ${sanitizeMarkdown(p.status)} |`,
  )
  .join('\n')}

### Desviaciones de Patrones Históricos
${report.historicalComparison.deviations.length > 0 ? report.historicalComparison.deviations.map((d) => `- ${sanitizeMarkdown(d)}`).join('\n') : '- No se identificaron desviaciones significativas'}

### Recomendaciones
${report.historicalComparison.recommendations.length > 0 ? report.historicalComparison.recommendations.map((r) => `- ${sanitizeMarkdown(r)}`).join('\n') : '- Continue with current estimation'}
`
    : `**Nota:** No hay referencias históricas disponibles.

**¿Por qué?** Esta estimación no puede compararse con proyectos similares porque:
- No existen datos históricos de proyectos que coincidan con estas tecnologías y complejidad
- O los datos históricos disponibles no cumplen los umbrales de calidad (tareas insuficientes completadas)
- O los filtros de rango de fechas excluyeron las referencias disponibles

**Recomendación:** Valida esta estimación con los stakeholders técnicos y documenta las horas reales al completar el proyecto para construir una base de referencias históricas.`
}

${statisticsSection}

## Supuestos y Exclusiones

### Supuestos Clave
${report.assumptions.map((a) => `- ${sanitizeMarkdown(a)}`).join('\n')}

### Exclusiones
${report.exclusions.map((e) => `- ${sanitizeMarkdown(e)}`).join('\n')}

## Validación Pendiente

${report.pendingValidation.length > 0 ? report.pendingValidation.map((p) => `- ${sanitizeMarkdown(p)}`).join('\n') : 'Ninguna identificada'}

## Gráficos de Distribución de Esfuerzo

### Por Perfil
\`\`\`mermaid
pie title Distribución de Esfuerzo por Perfil
    "Backend" : ${report.estimation.profileEffort.find(p => p.profile === 'backend')?.likelyHours || 0}
    "Frontend" : ${report.estimation.profileEffort.find(p => p.profile === 'frontend')?.likelyHours || 0}
    "QA" : ${report.estimation.profileEffort.find(p => p.profile === 'qa')?.likelyHours || 0}
    "DevOps" : ${report.estimation.profileEffort.find(p => p.profile === 'devops')?.likelyHours || 0}
\`\`\`

### Rango de Escenarios (Mín - Probable - Máx)
\`\`\`mermaid
graph LR
    A["Mín<br/>${report.estimation.scenariosHours.minHours}h"] -->|escenario| B["Probable<br/>${report.estimation.scenariosHours.likelyHours}h"]
    B -->|escenario| C["Máx<br/>${report.estimation.scenariosHours.maxHours}h"]
\`\`\`

---

*Esta estimación es preliminar y debe validarse con los stakeholders antes de comprometerse finalmente.*
`;

  return markdown;
}

function generateStatisticsSection(report: EstimationReport): string {
  // Mostrar análisis estadístico si está disponible
  let statisticsContent = '';

  // Sección 1: Calibración SP → Horas (si hay análisis estadístico)
  if (report.statisticalAnalysis) {
    const stat = report.statisticalAnalysis;
    statisticsContent += '\n## Calibración Estadística\n\n';
    statisticsContent += `**Fuente de Datos:** ${sanitizeMarkdown(stat.referenceSource)}\n`;
    statisticsContent += `**Registros Utilizados:** ${stat.recordsUsed}\n\n`;

    if (stat.backendCalibration) {
      const bc = stat.backendCalibration;
      statisticsContent += `### Perfil Backend\n`;
      statisticsContent += `- **Horas/Story Point:** ${bc.hoursPerSP.toFixed(2)} ± ${(bc.hoursPerSP * bc.coefficientOfVariation).toFixed(2)} h/SP\n`;
      statisticsContent += `- **Coeficiente de Variación:** ${(bc.coefficientOfVariation * 100).toFixed(1)}%\n`;
      statisticsContent += `- **Modelo:** ${sanitizeMarkdown(bc.model === 'proportional' ? 'Proporcional' : 'Regresión Lineal')}\n`;
      statisticsContent += `- **Calidad de Datos:** ${sanitizeMarkdown(bc.dataQuality.toUpperCase())}\n`;
      statisticsContent += `- **Tareas Analizadas:** ${bc.taskCount}\n\n`;
    }

    if (stat.frontendCalibration) {
      const fc = stat.frontendCalibration;
      statisticsContent += `### Perfil Frontend\n`;
      statisticsContent += `- **Horas/Story Point:** ${fc.hoursPerSP.toFixed(2)} ± ${(fc.hoursPerSP * fc.coefficientOfVariation).toFixed(2)} h/SP\n`;
      statisticsContent += `- **Coeficiente de Variación:** ${(fc.coefficientOfVariation * 100).toFixed(1)}%\n`;
      statisticsContent += `- **Modelo:** ${sanitizeMarkdown(fc.model === 'proportional' ? 'Proporcional' : 'Regresión Lineal')}\n`;
      statisticsContent += `- **Calidad de Datos:** ${sanitizeMarkdown(fc.dataQuality.toUpperCase())}\n`;
      statisticsContent += `- **Tareas Analizadas:** ${fc.taskCount}\n\n`;
    }

    if (stat.projectionSummary) {
      const proj = stat.projectionSummary;
      statisticsContent += `### Resumen de Proyección\n`;
      statisticsContent += `| Perfil | Story Points | Horas Proyectadas |\n`;
      statisticsContent += `|--------|---------|------|\n`;
      statisticsContent += `| **Backend** | ${proj.totalStoryPointsBackend} | ${proj.hoursBackend.toFixed(0)} h |\n`;
      statisticsContent += `| **Frontend** | ${proj.totalStoryPointsFrontend} | ${proj.hoursFrontend.toFixed(0)} h |\n`;
      statisticsContent += `| **Total** | ${proj.totalStoryPointsBackend + proj.totalStoryPointsFrontend} | ${proj.totalHours.toFixed(0)} h |\n\n`;

      statisticsContent += `**Rango de Escenarios:** ${proj.scenarioLow.toFixed(0)}–${proj.scenarioCentral.toFixed(0)}–${proj.scenarioHigh.toFixed(0)} horas (Bajo–Central–Alto)\n`;
      statisticsContent += `**Calidad de Calibración:** ${sanitizeMarkdown(proj.calibrationQuality.toUpperCase())}\n\n`;
    }

    if (stat.warnings.length > 0) {
      statisticsContent += `### Advertencias\n`;
      stat.warnings.forEach((w) => {
        statisticsContent += `- ${sanitizeMarkdown(w)}\n`;
      });
      statisticsContent += '\n';
    }
  } else if (report.historicalComparison.availableData) {
    // Fallback: mostrar datos históricos simples si no hay análisis estadístico
    const similar = report.historicalComparison.similarProjects;
    if (similar.length === 0) {
      return '';
    }

    const actualHours = similar.filter((p) => p.actualHours !== undefined && p.actualHours !== null).map((p) => p.actualHours || 0);

    statisticsContent = '\n## Análisis Estadístico\n\n';
    statisticsContent += '### Resumen de Datos Históricos\n\n';
    statisticsContent += `- **Proyectos de Referencia:** ${similar.length}\n`;
    statisticsContent += `- **Con Horas Reales:** ${actualHours.length}\n`;

    if (actualHours.length > 0) {
      const mean = actualHours.reduce((a, b) => a + b, 0) / actualHours.length;
      const sorted = [...actualHours].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = Math.min(...actualHours);
      const max = Math.max(...actualHours);

      statisticsContent += `- **Promedio de Horas Reales:** ${mean.toFixed(1)} h\n`;
      statisticsContent += `- **Mediana de Horas Reales:** ${median.toFixed(1)} h\n`;
      statisticsContent += `- **Rango:** ${min.toFixed(1)} – ${max.toFixed(1)} h\n`;

      if (actualHours.length > 1) {
        const variance = actualHours.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (actualHours.length - 1);
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100;
        statisticsContent += `- **Desviación Estándar:** ${stdDev.toFixed(1)} h (CV: ${cv.toFixed(1)}%)\n`;
      }
    }

    statisticsContent += '\n### Cobertura Tecnológica\n\n';
    const allTechs = new Set<string>();
    similar.forEach((p) => p.technologies.forEach((t) => allTechs.add(t)));
    statisticsContent += `- **Tecnologías:** ${Array.from(allTechs).join(', ')}\n`;
  }

  return statisticsContent;
}
