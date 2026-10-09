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

  let markdown = `# Estimation Report

**Project:** ${sanitizeMarkdown(report.briefId)}
**Generated:** ${new Date(report.generatedAt).toLocaleString()}
**Confidence Level:** ${report.confidenceLevel.toUpperCase()} (${extractConfidencePercentage(report.confidenceJustification)}%)

## Executive Summary

${sanitizeMarkdown(report.executiveSummary)}

### Confidence Justification
${sanitizeMarkdown(report.confidenceJustification)}

## Effort Overview

| Scenario | Hours | Work Days |
|----------|-------|-----------|
| **Minimum** | ${scenarios.minHours} h | ≈${scenarios.minDays} |
| **Most Likely** | ${scenarios.likelyHours} h | ≈${scenarios.likelyDays} |
| **Maximum** | ${scenarios.maxHours} h | ≈${scenarios.maxDays} |

**Note:** Work days represent person-days (based on ${config.estimation.hoursPerDay} hours/day). Actual calendar duration depends on team size and availability.

## Effort by Profile

| Profile | Min Hours | Likely Hours | Max Hours | Task Count |
|---------|-----------|--------------|-----------|-----------|
${profilesTable}

## Effort by Module

| Module | Min Hours | Likely Hours | Max Hours |
|--------|-----------|--------------|-----------|
${modulesTable}

## Functional Analysis

### Project Objective
${sanitizeMarkdown(report.functionalAnalysis.projectObjective)}

### Scope
${sanitizeMarkdown(report.functionalAnalysis.scope)}

### Modules and Functionalities
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

### Identified Gaps and Assumptions
- **Confidence Level:** ${(report.functionalAnalysis.confidenceLevel * 100).toFixed(0)}%
- **Gaps:** ${report.functionalAnalysis.gaps.length > 0 ? report.functionalAnalysis.gaps.map(g => sanitizeMarkdown(g)).join('; ') : 'None identified'}
- **Assumptions:** ${report.functionalAnalysis.assumptions.length > 0 ? report.functionalAnalysis.assumptions.map(a => sanitizeMarkdown(a)).join('; ') : 'None'}

## Technical Analysis

### Architecture
${sanitizeMarkdown(report.technicalAnalysis.architecture)}

### Technology Stack
${report.technicalAnalysis.technologyStack
  .map((t) => `- **${sanitizeMarkdown(t.name)}** (${sanitizeMarkdown(t.category)}): ${sanitizeMarkdown(t.justification || 'No justification provided')}`)
  .join('\n')}

### Technical Components
${report.technicalAnalysis.components
  .map(
    (c) => `
#### ${sanitizeMarkdown(c.name)}
- **Type:** ${sanitizeMarkdown(c.type)}
- **Complexity:** ${sanitizeMarkdown(c.complexity)}
- **Description:** ${sanitizeMarkdown(c.description)}
- **Rationale:** ${sanitizeMarkdown(c.rationale)}
- **Tasks:** ${c.tasks.length}
`,
  )
  .join('\n')}

### Identified Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
${risksTable}

## Estimation Breakdown

### Estimation Criteria
${sanitizeMarkdown(report.estimation.criteria)}

### Detailed Task Breakdown

| # | Task Name | Module | Profile | Complexity | Min Hours | Likely | Max Hours | Justification |
|----|-----------|--------|---------|------------|-----------|--------|-----------|---|
${report.estimation.tasks
  .map(
    (t, idx) =>
      `| ${idx + 1} | ${sanitizeMarkdown(t.name)} | ${sanitizeMarkdown(t.module)} | ${sanitizeMarkdown(t.profile)} | ${sanitizeMarkdown(t.complexity)} | ${t.minHours} | ${t.likelyHours} | ${t.maxHours} | ${sanitizeMarkdown((t.justification || 'N/A').substring(0, 50))} |`,
  )
  .join('\n')}

### Tasks Requiring Validation
${report.estimation.validationFlags.length > 0 ? report.estimation.validationFlags.map((f) => `- ${sanitizeMarkdown(f)}`).join('\n') : 'None identified'}

## Historical Comparison

**Similar Projects Found:** ${report.historicalComparison.similarProjects.length}

${
  report.historicalComparison.similarProjects.length > 0
    ? `
### Reference Projects

| Project ID | Type | Complexity | Est. Hours | Actual Hours | Status |
|----------|------|------------|-----------|--------------|--------|
${report.historicalComparison.similarProjects
  .map(
    (p) =>
      `| ${sanitizeMarkdown(p.projectId)} | ${sanitizeMarkdown(p.projectType)} | ${sanitizeMarkdown(p.complexity)} | ${p.estimatedHours} | ${p.actualHours ? p.actualHours.toFixed(0) : 'TBD'} | ${sanitizeMarkdown(p.status)} |`,
  )
  .join('\n')}

### Deviations from Historical Patterns
${report.historicalComparison.deviations.length > 0 ? report.historicalComparison.deviations.map((d) => `- ${sanitizeMarkdown(d)}`).join('\n') : '- No significant deviations identified'}

### Recommendations
${report.historicalComparison.recommendations.length > 0 ? report.historicalComparison.recommendations.map((r) => `- ${sanitizeMarkdown(r)}`).join('\n') : '- Continue with current estimation'}
`
    : `**Note:** No historical references available.

**Why?** This estimation cannot be compared against similar projects because:
- No historical project data exists matching these technologies and complexity
- Or available historical data does not meet quality thresholds (insufficient tasks completed)
- Or date range filters excluded available references

**Recommendation:** Validate this estimation with technical stakeholders and document actual hours upon project completion to build historical reference base.`
}

${statisticsSection}

## Assumptions and Exclusions

### Key Assumptions
${report.assumptions.map((a) => `- ${sanitizeMarkdown(a)}`).join('\n')}

### Exclusions
${report.exclusions.map((e) => `- ${sanitizeMarkdown(e)}`).join('\n')}

## Pending Validation

${report.pendingValidation.length > 0 ? report.pendingValidation.map((p) => `- ${sanitizeMarkdown(p)}`).join('\n') : 'None identified'}

## Effort Distribution Charts

### By Profile
\`\`\`mermaid
graph LR
    A["Backend<br/>${report.estimation.profileEffort.find(p => p.profile === 'backend')?.likelyHours || 0}h"] -->|"${((report.estimation.profileEffort.find(p => p.profile === 'backend')?.likelyHours || 0) / report.estimation.scenariosHours.likelyHours * 100).toFixed(0)}%"| Total["Total<br/>${report.estimation.scenariosHours.likelyHours}h"]
    B["Frontend<br/>${report.estimation.profileEffort.find(p => p.profile === 'frontend')?.likelyHours || 0}h"] -->|"${((report.estimation.profileEffort.find(p => p.profile === 'frontend')?.likelyHours || 0) / report.estimation.scenariosHours.likelyHours * 100).toFixed(0)}%"| Total
    C["QA<br/>${report.estimation.profileEffort.find(p => p.profile === 'qa')?.likelyHours || 0}h"] -->|"${((report.estimation.profileEffort.find(p => p.profile === 'qa')?.likelyHours || 0) / report.estimation.scenariosHours.likelyHours * 100).toFixed(0)}%"| Total
    D["DevOps<br/>${report.estimation.profileEffort.find(p => p.profile === 'devops')?.likelyHours || 0}h"] -->|"${((report.estimation.profileEffort.find(p => p.profile === 'devops')?.likelyHours || 0) / report.estimation.scenariosHours.likelyHours * 100).toFixed(0)}%"| Total
\`\`\`

### Scenario Range (Min - Likely - Max)
\`\`\`mermaid
graph LR
    A["Min<br/>${report.estimation.scenariosHours.minHours}h"] -->|"likelihood"| B["Likely<br/>${report.estimation.scenariosHours.likelyHours}h"]
    B -->|"likelihood"| C["Max<br/>${report.estimation.scenariosHours.maxHours}h"]
\`\`\`

---

*This estimation is preliminary and should be validated with stakeholders before final commitment.*
`;

  return markdown;
}

function generateStatisticsSection(report: EstimationReport): string {
  // Mostrar análisis estadístico si está disponible
  let statisticsContent = '';

  // Sección 1: Calibración SP → Horas (si hay análisis estadístico)
  if (report.statisticalAnalysis) {
    const stat = report.statisticalAnalysis;
    statisticsContent += '\n## Statistical Calibration\n\n';
    statisticsContent += `**Data Source:** ${sanitizeMarkdown(stat.referenceSource)}\n`;
    statisticsContent += `**Records Used:** ${stat.recordsUsed}\n\n`;

    if (stat.backendCalibration) {
      const bc = stat.backendCalibration;
      statisticsContent += `### Backend Profile\n`;
      statisticsContent += `- **Hours/Story Point:** ${bc.hoursPerSP.toFixed(2)} ± ${(bc.hoursPerSP * bc.coefficientOfVariation).toFixed(2)} h/SP\n`;
      statisticsContent += `- **Coefficient of Variation:** ${(bc.coefficientOfVariation * 100).toFixed(1)}%\n`;
      statisticsContent += `- **Model:** ${sanitizeMarkdown(bc.model === 'proportional' ? 'Proportional' : 'Linear Regression')}\n`;
      statisticsContent += `- **Data Quality:** ${sanitizeMarkdown(bc.dataQuality.toUpperCase())}\n`;
      statisticsContent += `- **Tasks Analyzed:** ${bc.taskCount}\n\n`;
    }

    if (stat.frontendCalibration) {
      const fc = stat.frontendCalibration;
      statisticsContent += `### Frontend Profile\n`;
      statisticsContent += `- **Hours/Story Point:** ${fc.hoursPerSP.toFixed(2)} ± ${(fc.hoursPerSP * fc.coefficientOfVariation).toFixed(2)} h/SP\n`;
      statisticsContent += `- **Coefficient of Variation:** ${(fc.coefficientOfVariation * 100).toFixed(1)}%\n`;
      statisticsContent += `- **Model:** ${sanitizeMarkdown(fc.model === 'proportional' ? 'Proportional' : 'Linear Regression')}\n`;
      statisticsContent += `- **Data Quality:** ${sanitizeMarkdown(fc.dataQuality.toUpperCase())}\n`;
      statisticsContent += `- **Tasks Analyzed:** ${fc.taskCount}\n\n`;
    }

    if (stat.projectionSummary) {
      const proj = stat.projectionSummary;
      statisticsContent += `### Projection Summary\n`;
      statisticsContent += `| Profile | Story Points | Projected Hours |\n`;
      statisticsContent += `|---------|---------|------|\n`;
      statisticsContent += `| **Backend** | ${proj.totalStoryPointsBackend} | ${proj.hoursBackend.toFixed(0)} h |\n`;
      statisticsContent += `| **Frontend** | ${proj.totalStoryPointsFrontend} | ${proj.hoursFrontend.toFixed(0)} h |\n`;
      statisticsContent += `| **Total** | ${proj.totalStoryPointsBackend + proj.totalStoryPointsFrontend} | ${proj.totalHours.toFixed(0)} h |\n\n`;

      statisticsContent += `**Scenario Range:** ${proj.scenarioLow.toFixed(0)}–${proj.scenarioCentral.toFixed(0)}–${proj.scenarioHigh.toFixed(0)} hours (Low–Central–High)\n`;
      statisticsContent += `**Calibration Quality:** ${sanitizeMarkdown(proj.calibrationQuality.toUpperCase())}\n\n`;
    }

    if (stat.warnings.length > 0) {
      statisticsContent += `### Warnings\n`;
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

    statisticsContent = '\n## Statistical Analysis\n\n';
    statisticsContent += '### Historical Data Summary\n\n';
    statisticsContent += `- **Reference Projects:** ${similar.length}\n`;
    statisticsContent += `- **With Actual Hours:** ${actualHours.length}\n`;

    if (actualHours.length > 0) {
      const mean = actualHours.reduce((a, b) => a + b, 0) / actualHours.length;
      const sorted = [...actualHours].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const min = Math.min(...actualHours);
      const max = Math.max(...actualHours);

      statisticsContent += `- **Average Actual Hours:** ${mean.toFixed(1)} h\n`;
      statisticsContent += `- **Median Actual Hours:** ${median.toFixed(1)} h\n`;
      statisticsContent += `- **Range:** ${min.toFixed(1)} – ${max.toFixed(1)} h\n`;

      if (actualHours.length > 1) {
        const variance = actualHours.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / (actualHours.length - 1);
        const stdDev = Math.sqrt(variance);
        const cv = (stdDev / mean) * 100;
        statisticsContent += `- **Std. Deviation:** ${stdDev.toFixed(1)} h (CV: ${cv.toFixed(1)}%)\n`;
      }
    }

    statisticsContent += '\n### Technology Coverage\n\n';
    const allTechs = new Set<string>();
    similar.forEach((p) => p.technologies.forEach((t) => allTechs.add(t)));
    statisticsContent += `- **Technologies:** ${Array.from(allTechs).join(', ')}\n`;
  }

  return statisticsContent;
}
