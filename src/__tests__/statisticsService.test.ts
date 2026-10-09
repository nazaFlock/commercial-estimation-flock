import { statisticsService } from '../services/statisticsService.js';
import { HistoricalRecordExtended } from '../types.js';

describe('StatisticsService', () => {
  // Datos ficticios para pruebas
  const mockRecords: HistoricalRecordExtended[] = [
    {
      id: 'task-1',
      projectId: 'proj-1',
      projectType: 'API',
      scope: 'User API',
      technologies: ['Node.js', 'PostgreSQL'],
      functionalities: ['CRUD'],
      complexity: 'low',
      estimatedHours: 40,
      actualHours: 35,
      responsibleProfile: 'backend',
      date: '2026-01-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 5,
      backend: true,
    },
    {
      id: 'task-2',
      projectId: 'proj-1',
      projectType: 'API',
      scope: 'Auth Service',
      technologies: ['Node.js'],
      functionalities: ['Auth'],
      complexity: 'medium',
      estimatedHours: 80,
      actualHours: 85,
      responsibleProfile: 'backend',
      date: '2026-02-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 8,
      backend: true,
    },
    {
      id: 'task-3',
      projectId: 'proj-1',
      projectType: 'Frontend',
      scope: 'Dashboard UI',
      technologies: ['React'],
      functionalities: ['UI'],
      complexity: 'medium',
      estimatedHours: 60,
      actualHours: 72,
      responsibleProfile: 'frontend',
      date: '2026-03-15',
      status: 'completed',
      fictitious: false,
      storyPointsInitial: 8,
      frontend: true,
    },
  ];

  test('calculateDescriptiveStats - should calculate mean, median, std', () => {
    const values = [35, 85, 72];
    const stats = statisticsService.calculateDescriptiveStats(values);

    expect(stats).not.toBeNull();
    expect(stats?.count).toBe(3);
    expect(stats?.mean).toBeCloseTo(64, 1);
    expect(stats?.median).toBe(72);
    expect(stats?.min).toBe(35);
    expect(stats?.max).toBe(85);
    expect(stats?.standardDeviation).toBeGreaterThan(0);
  });

  test('calculateDescriptiveStats - should handle empty array', () => {
    const stats = statisticsService.calculateDescriptiveStats([]);
    expect(stats).toBeNull();
  });

  test('calculateRatioStatistics - should calculate hours/SP', () => {
    const stats = statisticsService.calculateRatioStatistics(mockRecords, 'hours_per_sp');

    expect(stats).not.toBeNull();
    expect(stats?.ratioType).toBe('hours_per_sp');
    expect(stats?.count).toBe(3);
    expect(stats?.mean).toBeGreaterThan(0);
  });

  test('calculateAggregateRatio - should return total hours / total SP', () => {
    const aggregate = statisticsService.calculateAggregateRatio(mockRecords, 'hours_per_sp');

    expect(aggregate).not.toBeNull();
    expect(aggregate?.totalHours).toBe(192); // 35 + 85 + 72
    expect(aggregate?.totalSP).toBe(21); // 5 + 8 + 8
    expect(aggregate?.ratio).toBeCloseTo(192 / 21, 2);
  });

  test('detectOutliers - should identify Z-score outliers', () => {
    const values = [10, 12, 11, 13, 100]; // 100 is outlier
    const { outliers, indices } = statisticsService.detectOutliers(values, 2.0);

    expect(outliers.length).toBeGreaterThan(0);
    expect(outliers).toContain(100);
  });

  test('calculateScenarios - should generate low/central/high', () => {
    const stats = statisticsService.calculateDescriptiveStats([35, 85, 72])!;
    const scenarios = statisticsService.calculateScenarios(64, stats);

    expect(scenarios.low).toBeLessThan(scenarios.central);
    expect(scenarios.central).toBeLessThan(scenarios.high);
    expect(scenarios.central).toBe(64);
  });

  test('validateSPConsistency - should detect inconsistent SP changes', () => {
    const inconsistentRecord: HistoricalRecordExtended = {
      ...mockRecords[0],
      storyPointsInitial: 5,
      storyPointsFinal: 15, // > 2x increase
    };

    const result = statisticsService.validateSPConsistency([inconsistentRecord]);
    expect(result.inconsistent.length).toBe(1);
    expect(result.inconsistent[0].reason).toContain('changed significantly');
  });
});
