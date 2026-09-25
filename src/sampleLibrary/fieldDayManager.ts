// LISA: Field Day Route Workflow Manager
// Simulates an in-field surveyor water-testing route.
// Sequentially executes route stops, persists each into audit history,
// and computes live route statistics dynamically from genuine measurement records.

import { FieldDayRoute, FieldDaySummary, ScenarioRunResult } from './types';
import { SAMPLE_SCENARIOS } from './scenarios';
import { runSampleScenario } from './runner';
import { MeasurementRecord } from '../types';

export const TODAY_WATER_ROUTE: FieldDayRoute = {
  id: 'ROUTE-HARYANA-NORTH-01',
  title: "Today's Water Route: Sonipat Catchment Area",
  date: '2026-09-26',
  surveyor: 'Environmental Health Officer (Field Kit #4)',
  stops: [
    {
      stopNumber: 1,
      timeLabel: '08:30',
      locationName: 'Borewell A (North Community Pump House)',
      scenarioId: 'scen-borewell-water',
      notes: 'Routine monthly groundwater monitoring. Check for sub-surface fertilizer percolation.',
      targetReferenceMaxMgL: 0.10,
    },
    {
      stopNumber: 2,
      timeLabel: '09:15',
      locationName: 'Primary School Drinking Water Cooler (Tap)',
      scenarioId: 'scen-tap-water',
      notes: 'Child health compliance check. Piped drinking water must remain strictly safe (<0.10 mg P/L).',
      targetReferenceMaxMgL: 0.10,
    },
    {
      stopNumber: 3,
      timeLabel: '10:05',
      locationName: 'Agricultural Drain Canal (Culvert 3)',
      scenarioId: 'scen-stormwater-drain',
      notes: 'Receives mixed furrow irrigation runoff and village road drainage.',
      targetReferenceMaxMgL: 0.20,
    },
    {
      stopNumber: 4,
      timeLabel: '11:20',
      locationName: 'East Village Pond (Eutrophication Survey)',
      scenarioId: 'scen-village-pond',
      notes: 'Historical algal bloom site. Sample taken from littoral zone.',
      targetReferenceMaxMgL: 0.10,
    },
    {
      stopNumber: 5,
      timeLabel: '12:10',
      locationName: 'Kiosk RO Water Purifier Outlet',
      scenarioId: 'scen-ro-water',
      notes: 'Membrane integrity validation test. Should read near 0.00 mg P/L.',
      targetReferenceMaxMgL: 0.05,
    },
    {
      stopNumber: 6,
      timeLabel: '12:45',
      locationName: 'Suspicious Chemical Discharge (Industrial Culvert)',
      scenarioId: 'scen-unknown-dye',
      notes: 'Unreported yellow colored discharge reported by villagers. Anomaly verification.',
      targetReferenceMaxMgL: 0.10,
    },
  ],
};

export function executeRouteStop(
  stopIndex: number,
  route: FieldDayRoute = TODAY_WATER_ROUTE
): { runResult: ScenarioRunResult; record: MeasurementRecord } {
  const stop = route.stops[stopIndex];
  if (!stop) {
    throw new Error(`Invalid stop index: ${stopIndex}`);
  }

  const scenario = SAMPLE_SCENARIOS.find((s) => s.id === stop.scenarioId) || SAMPLE_SCENARIOS[0];
  const { pipelineResult, runResult } = runSampleScenario(scenario, {
    seedOverride: `LISA-FIELD-ROUTE-${route.id}-STOP-${stop.stopNumber}`,
  });

  return {
    runResult,
    record: pipelineResult.record,
  };
}

export function computeFieldDaySummary(
  route: FieldDayRoute,
  completedRuns: ScenarioRunResult[]
): FieldDaySummary {
  let withinReferenceRange = 0;
  let alertCount = 0;
  let rejectedCount = 0;

  for (let i = 0; i < completedRuns.length; i++) {
    const res = completedRuns[i];
    const stop = route.stops[i];
    const targetMax = stop?.targetReferenceMaxMgL ?? 0.10;

    if (res.isRejected) {
      rejectedCount++;
    } else if (res.predictedConcentration !== null && res.predictedConcentration > targetMax) {
      alertCount++;
    } else {
      withinReferenceRange++;
    }
  }

  return {
    routeId: route.id,
    totalStops: route.stops.length,
    completedStops: completedRuns.length,
    withinReferenceRange,
    alertCount,
    rejectedCount,
    records: completedRuns,
  };
}
