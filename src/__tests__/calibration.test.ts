import { spToHoursCalibration } from '../services/spToHoursCalibration.js';
import { HistoricalRecordExtended } from '../types.js';

describe('SPToHoursCalibration', () => {
  const mockRecords: HistoricalRecordExtended[] = [
    {
      id: 'backend-1',
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
      id: 'backend-2',
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
      id: 'frontend-1',
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

  test('calibrateProfile - should calculate backend factor', () => {
    const calibration = spToHoursCalibration.calibrateProfile(mockRecords, 'backend', 'test');

    expect(calibration).not.toBeNull();
    expect(calibration?.profile).toBe('backend');
    expect(calibration?.hoursPerSP).toBeCloseTo((40 + 80) / (5 + 8), 2); // 120/13 ≈ 9.23
    expect(calibration?.taskCount).toBe(2);
  });

  test('calibrateProfile - should calculate frontend factor', () => {
    const calibration = spToHoursCalibration.calibrateProfile(mockRecords, 'frontend', 'test');

    expect(calibration).not.toBeNull();
    expect(calibration?.profile).toBe('frontend');
    expect(calibration?.hoursPerSP).toBeCloseTo(60 / 8, 1); // 7.5
    expect(calibration?.taskCount).toBe(1);
  });

  test('calibrateProfile - should return null when no records', () => {
    const calibration = spToHoursCalibration.calibrateProfile([], 'backend', 'test');
    expect(calibration).toBeNull();
  });

  test('projectHours - should project hours for new task', () => {
    const calibration = spToHoursCalibration.calibrateProfile(mockRecords, 'backend', 'test')!;
    const projection = spToHoursCalibration.projectHours(5, calibration);

    expect(projection.profile).toBe('backend');
    expect(projection.storyPoints).toBe(5);
    expect(projection.hoursProjected).toBeGreaterThan(0);
    expect(projection.scenario.low).toBeLessThan(projection.scenario.central);
    expect(projection.scenario.central).toBeLessThan(projection.scenario.high);
  });

  test('projectHours - should avoid negative projections', () => {
    const calibration = spToHoursCalibration.calibrateProfile(mockRecords, 'backend', 'test')!;
    const projection = spToHoursCalibration.projectHours(-5, calibration);

    expect(projection.hoursProjected).toBeGreaterThanOrEqual(0);
  });
});
