export interface Brief {
  id: string;
  title: string;
  description: string;
  businessContext?: string;
  constraints?: string[];
  deadline?: string;
  budget?: string;
  technicalContext?: string;
  createdAt: string;
}

export interface FunctionalAnalysis {
  projectObjective: string;
  scope: string;
  modules: Module[];
  externalIntegrations: string[];
  assumptions: string[];
  gaps: string[];
  confidenceLevel: number;
  analysisNotes: string;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  functionalities: Functionality[];
  priority?: 'high' | 'medium' | 'low';
}

export interface Functionality {
  id: string;
  name: string;
  description: string;
  requirements: string[];
  dependencies?: string[];
  complexity?: 'low' | 'medium' | 'high';
}

export interface TechnicalAnalysis {
  components: TechnicalComponent[];
  architecture: string;
  technologyStack: Technology[];
  risks: Risk[];
  dependencies: string[];
  developmentConcerns: string[];
}

export interface TechnicalComponent {
  name: string;
  description: string;
  type: 'backend' | 'frontend' | 'database' | 'integration' | 'testing';
  tasks: TechnicalTask[];
  complexity: 'low' | 'medium' | 'high';
  rationale: string;
}

export interface TechnicalTask {
  id: string;
  name: string;
  description: string;
  complexity: 'low' | 'medium' | 'high';
  estimatedDays?: number;
  dependencies?: string[];
}

export interface Technology {
  name: string;
  category: string;
  justification?: string;
}

export interface Risk {
  description: string;
  likelihood: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation?: string;
}

export interface EstimationResult {
  tasks: EstimatedTask[];
  moduleEffort: ModuleEffort[];
  profileEffort: ProfileEffort[];
  scenariosHours: Scenarios;
  criteria: string;
  validationFlags: string[];
}

export interface EstimatedTask {
  id: string;
  name: string;
  module: string;
  complexity: 'low' | 'medium' | 'high';
  minHours: number;
  likelyHours: number;
  maxHours: number;
  profile: string;
  justification?: string;
}

export interface ModuleEffort {
  moduleId: string;
  moduleName: string;
  minHours: number;
  likelyHours: number;
  maxHours: number;
}

export interface ProfileEffort {
  profile: string;
  minHours: number;
  likelyHours: number;
  maxHours: number;
  taskCount: number;
}

export interface Scenarios {
  minHours: number;
  likelyHours: number;
  maxHours: number;
  minDays: number;
  likelyDays: number;
  maxDays: number;
}

export interface HistoricalRecord {
  id: string;
  projectId: string;
  projectType: string;
  scope: string;
  technologies: string[];
  functionalities: string[];
  complexity: 'low' | 'medium' | 'high';
  estimatedHours: number;
  actualHours?: number;
  responsibleProfile: string;
  date: string;
  status: 'planned' | 'ongoing' | 'completed' | 'cancelled';
  notes?: string;
  fictitious: boolean;
}

export interface HistoricalComparison {
  similarProjects: HistoricalRecord[];
  deviations: string[];
  recommendations: string[];
  availableData: boolean;
}

export interface EstimationReport {
  id: string;
  briefId: string;
  generatedAt: string;
  executiveSummary: string;
  functionalAnalysis: FunctionalAnalysis;
  technicalAnalysis: TechnicalAnalysis;
  estimation: EstimationResult;
  historicalComparison: HistoricalComparison;
  statisticalAnalysis?: StatisticalAnalysis;
  assumptions: string[];
  exclusions: string[];
  pendingValidation: string[];
  confidenceLevel: 'low' | 'medium' | 'high';
  confidenceJustification: string;
  nextSteps?: string[];
}

export interface AgentContext {
  briefId: string;
  brief?: Brief;
  functionalAnalysis?: FunctionalAnalysis;
  technicalAnalysis?: TechnicalAnalysis;
  estimation?: EstimationResult;
  historicalComparison?: HistoricalComparison;
  statisticalAnalysis?: StatisticalAnalysis;
  errors: string[];
}

// ===== NUEVAS INTERFACES PARA MULTI-MCP =====

export interface MCPConnection {
  id: string;
  type: 'jira' | 'azure' | 'github' | 'other';
  name: string;
  config: Record<string, unknown>;
  status: 'available' | 'unavailable';
  tools?: string[];
  lastChecked?: string;
}

// Interfaz moved to adapters/HistoricalReferenceProvider.ts
// Import from there instead: import { IHistoricalReferenceProvider } from '../adapters/HistoricalReferenceProvider.js';

export interface ReferenceSelection {
  mode: 'manual' | 'automatic';
  selectedReferences: string[];
  justification?: string;
  dateRange?: {
    from: string;
    to: string;
  };
  filters?: {
    profile?: 'backend' | 'frontend' | 'both';
    minStoryPoints?: number;
    maxStoryPoints?: number;
    status?: string[];
    team?: string;
  };
  source?: 'jira' | 'file' | 'csv' | 'hybrid';
}

// Extender HistoricalRecord con campos adicionales
export interface HistoricalRecordExtended extends HistoricalRecord {
  sourceId?: string;
  connectionId?: string;
  clientId?: string;
  teamId?: string;
  jiraIssueKey?: string;
  jiraWorklog?: number;
  storyPointsInitial?: number;
  storyPointsFinal?: number;
  backend?: boolean;
  frontend?: boolean;
}

// ===== INTERFACES PARA MOTOR ESTADÍSTICO =====

export interface StatisticalAnalysis {
  referenceSource: string;
  recordsUsed: number;
  dateRange: { from: string; to: string };
  backendCalibration?: CalibrationFactorSummary;
  frontendCalibration?: CalibrationFactorSummary;
  projectionSummary?: ProjectionSummarySerialized;
  warnings: string[];
}

export interface CalibrationFactorSummary {
  profile: 'backend' | 'frontend';
  hoursPerSP: number;
  taskCount: number;
  coefficientOfVariation: number;
  model: 'proportional' | 'linear_regression';
  dataQuality: 'high' | 'medium' | 'low';
}

export interface ProjectionSummarySerialized {
  totalStoryPointsBackend: number;
  totalStoryPointsFrontend: number;
  hoursBackend: number;
  hoursFrontend: number;
  totalHours: number;
  scenarioLow: number;
  scenarioCentral: number;
  scenarioHigh: number;
  calibrationQuality: 'high' | 'medium' | 'low';
}
