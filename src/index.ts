export * from './types.js';
export * from './config.js';
export * from './workflows/estimateProposal.js';
export * from './services/reportGenerator.js';
export { claudeClient } from './services/claudeClient.js';
export { historicalDataService } from './services/historicalDataService.js';
export { logger } from './utils/logger.js';

export async function runDemo(): Promise<void> {
  console.log('Commercial Estimation Orchestrator - Demo');
  console.log('Use: npm run estimate -- <path-to-brief>');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runDemo().catch(console.error);
}
