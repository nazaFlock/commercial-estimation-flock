import * as fs from 'fs';
import * as path from 'path';
import { Brief, ReferenceSelection, MCPConnection } from './types.js';
import { validateConfig, config } from './config.js';
import { logger } from './utils/logger.js';
import { readTextFile, generateUniqueId } from './utils/fileUtils.js';
import { executeEstimateProposal } from './workflows/estimateProposal.js';
import { generateReports } from './services/reportGenerator.js';
import { mcpConnectorService } from './services/mcpConnectorService.js';

async function main() {
  try {
    validateConfig();

    const args = process.argv.slice(2);
    if (args.length === 0) {
      console.log(`
Usage: npm run estimate -- <path-to-brief-file> [options]

Options:
  --data-source <source>    Data source for historical references (file|jira|csv|hybrid)
                           Default: file
  --references <mode>       Reference selection mode (manual|automatic)
                           Default: manual
  --jira-project <project>  Jira project key for historical data
                           Requires fedpat-jira MCP availability

Example:
  npm run estimate -- ./examples/brief-ejemplo.md
  npm run estimate -- ./examples/brief-ejemplo.md --data-source jira --jira-project PROJ

The brief file should be in Markdown format with a clear description
of the commercial project requirements.
      `);
      process.exit(1);
    }

    const briefPath = args[0];

    if (!fs.existsSync(briefPath)) {
      logger.error(`Brief file not found: ${briefPath}`);
      process.exit(1);
    }

    // Parse CLI arguments
    const dataSource = args.includes('--data-source')
      ? args[args.indexOf('--data-source') + 1] || config.historicalDataSource.default
      : config.historicalDataSource.default;

    const referenceMode = args.includes('--references')
      ? args[args.indexOf('--references') + 1] || 'manual'
      : 'manual';

    const jiraProject = args.includes('--jira-project')
      ? args[args.indexOf('--jira-project') + 1]
      : undefined;

    // Register Jira connection if specified
    let connection: MCPConnection | undefined;
    if (jiraProject) {
      mcpConnectorService.registerJiraConnection(jiraProject);
      connection = mcpConnectorService.getConnection('fedpat-jira-prod');
      logger.info(`Jira connection registered for project: ${jiraProject}`);
    }

    // Create reference selection config
    const referenceSelection: ReferenceSelection = {
      mode: referenceMode as 'manual' | 'automatic',
      selectedReferences: [],
      source: dataSource as 'jira' | 'file' | 'csv' | 'hybrid',
      filters: {
        profile: 'both',
        minStoryPoints: 1,
        maxStoryPoints: 100,
        status: ['completed'],
      },
      dateRange: {
        from: new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0],
      },
    };

    // Read brief
    logger.info(`Reading brief from: ${briefPath}`);
    const briefContent = readTextFile(briefPath);

    // Create brief object
    const brief: Brief = {
      id: generateUniqueId(),
      title: path.basename(briefPath, path.extname(briefPath)),
      description: briefContent,
      createdAt: new Date().toISOString(),
    };

    logger.info(`Starting estimation for brief: ${brief.title}`);
    console.log('\n' + '='.repeat(60));
    console.log(`COMMERCIAL ESTIMATION ORCHESTRATOR`);
    console.log(`Brief: ${brief.title}`);
    console.log(`Historical Data Source: ${dataSource}`);
    console.log(`Reference Selection Mode: ${referenceMode}`);
    if (jiraProject) console.log(`Jira Project: ${jiraProject}`);
    console.log('='.repeat(60) + '\n');

    // Execute workflow
    const report = await executeEstimateProposal(brief, referenceSelection, connection);

    // Generate reports
    const { jsonPath, markdownPath } = generateReports(report);

    console.log('\n' + '='.repeat(60));
    console.log('ESTIMATION COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nEstimated Effort (Most Likely): ${report.estimation.scenariosHours.likelyHours} hours (${report.estimation.scenariosHours.likelyDays} days)`);
    console.log(`Confidence Level: ${report.confidenceLevel.toUpperCase()}`);
    console.log(`\nReports generated:`);
    console.log(`  JSON: ${jsonPath}`);
    console.log(`  Markdown: ${markdownPath}`);
    console.log(`\n${'-'.repeat(60)}\n`);

  } catch (error) {
    logger.error(`CLI execution failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
