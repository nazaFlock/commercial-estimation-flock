import { projectionService } from '../services/projectionService.js';
import { TechnicalAnalysis, HistoricalRecordExtended } from '../types.js';

describe('ProjectionService', () => {
  const mockTechnicalAnalysis: TechnicalAnalysis = {
    components: [
      {
        name: 'Backend API',
        description: 'REST API',
        type: 'backend',
        complexity: 'medium',
        rationale: 'Core service',
        tasks: [
          { id: 'task-1', name: 'User Endpoints', description: 'CRUD', complexity: 'medium' },
          { id: 'task-2', name: 'Auth Service', description: 'JWT', complexity: 'high' },
        ],
      },
      {
        name: 'Frontend UI',
        description: 'React Dashboard',
        type: 'frontend',
        complexity: 'medium',
        rationale: 'User interface',
        tasks: [{ id: 'task-3', name: 'Dashboard Page', description: 'Responsive UI', complexity: 'medium' }],
      },
    ],
    architecture: 'Microservices',
    technologyStack: [{ name: 'Node.js', category: 'runtime' }],
    risks: [],
    dependencies: [],
    developmentConcerns: [],
  };

  const mockRecords: HistoricalRecordExtended[] = [
    {
      id: 'hist-1',
      projectId: 'proj-1',
      projectType: 'API',
      scope: 'User API',
      technologies: ['Node.js'],
      functionalities: ['CRUD'],
      complexity: 'low',
      estimatedHours: 40,
      actualHours: 40,
      responsibleProfile: 'backend',
      date: '2026-01-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 5,
      backend: true,
    },
    {
      id: 'hist-2',
      projectId: 'proj-1',
      projectType: 'API',
      scope: 'Auth',
      technologies: ['Node.js'],
      functionalities: ['Auth'],
      complexity: 'medium',
      estimatedHours: 80,
      actualHours: 80,
      responsibleProfile: 'backend',
      date: '2026-02-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 8,
      backend: true,
    },
    {
      id: 'hist-3',
      projectId: 'proj-2',
      projectType: 'Frontend',
      scope: 'Dashboard',
      technologies: ['React'],
      functionalities: ['UI'],
      complexity: 'medium',
      estimatedHours: 60,
      actualHours: 60,
      responsibleProfile: 'frontend',
      date: '2026-03-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 8,
      frontend: true,
    },
  ];

  test('projectProposal - should generate projection summary', () => {
    const summary = projectionService.projectProposal(mockTechnicalAnalysis, mockRecords, 'test');

    expect(summary).not.toBeNull();
    expect(summary.totalStoryPointsBackend).toBeGreaterThan(0);
    expect(summary.totalStoryPointsFrontend).toBeGreaterThan(0);
    expect(summary.hoursBackend).toBeGreaterThan(0);
    expect(summary.hoursFrontend).toBeGreaterThan(0);
    expect(summary.totalHours).toBeGreaterThan(0);
  });

  test('projectProposal - should calculate scenarios', () => {
    const summary = projectionService.projectProposal(mockTechnicalAnalysis, mockRecords, 'test');

    expect(summary.scenarioLow).toBeLessThan(summary.scenarioCentral);
    expect(summary.scenarioCentral).toBeLessThan(summary.scenarioHigh);
    expect(summary.scenarioLow).toBeGreaterThanOrEqual(0);
  });

  test('projectProposal - should include breakdown', () => {
    const summary = projectionService.projectProposal(mockTechnicalAnalysis, mockRecords, 'test');

    expect(summary.breakdown.length).toBeGreaterThan(0);
    summary.breakdown.forEach((item) => {
      expect(item.module).toBeDefined();
      expect(item.task).toBeDefined();
      expect(item.hoursProjected).toBeGreaterThanOrEqual(0);
      expect(item.calibrationFactor).toBeGreaterThan(0);
    });
  });

  test('projectProposal - should warn on insufficient data', () => {
    const summary = projectionService.projectProposal(mockTechnicalAnalysis, [], 'test');

    expect(summary.warnings.length).toBeGreaterThan(0);
  });
});
