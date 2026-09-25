// LISA: Field Day Route View Component
// Sequential multi-sample field survey workflow ("Today's Water Route").
// Adds completed runs to audit history and calculates dynamic live summaries.

import React, { useState } from 'react';
import { FieldDayRoute, ScenarioRunResult } from '../types';
import { TODAY_WATER_ROUTE, executeRouteStop, computeFieldDaySummary } from '../fieldDayManager';
import { Play, RotateCcw, MapPin } from 'lucide-react';
import { MeasurementRecord } from '../../types';

interface FieldDayViewProps {
  onRecordAdded?: (record: MeasurementRecord) => void;
}

export const FieldDayView: React.FC<FieldDayViewProps> = ({ onRecordAdded }) => {
  const [route] = useState<FieldDayRoute>(TODAY_WATER_ROUTE);
  const [completedResults, setCompletedResults] = useState<ScenarioRunResult[]>([]);
  const [activeStopIndex, setActiveStopIndex] = useState<number>(0);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const summary = computeFieldDaySummary(route, completedResults);

  const handleRunCurrentStop = () => {
    if (activeStopIndex >= route.stops.length) return;
    setIsRunning(true);

    setTimeout(() => {
      const { runResult, record } = executeRouteStop(activeStopIndex, route);
      const updated = [...completedResults, runResult];
      setCompletedResults(updated);
      setActiveStopIndex((prev) => prev + 1);
      setIsRunning(false);

      if (onRecordAdded) {
        onRecordAdded(record);
      }
    }, 400);
  };

  const handleResetRoute = () => {
    setCompletedResults([]);
    setActiveStopIndex(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Route Header */}
      <div
        style={{
          background: 'var(--surface-sunken)',
          padding: '16px 20px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--line)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={16} color="var(--accent)" />
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Field Day Protocol
            </span>
          </div>
          <h3 style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 600, color: 'var(--ink)' }}>
            {route.title}
          </h3>
          <div style={{ fontSize: 12.5, color: 'var(--ink-2)', marginTop: 2 }}>
            Surveyor: {route.surveyor} • Date: {route.date}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {completedResults.length > 0 && (
            <button
              type="button"
              className="btn btn--secondary"
              onClick={handleResetRoute}
              style={{ padding: '8px 14px' }}
            >
              <RotateCcw size={13} aria-hidden="true" />
              <span>Reset Route</span>
            </button>
          )}

          {activeStopIndex < route.stops.length ? (
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleRunCurrentStop}
              disabled={isRunning}
              style={{ padding: '8px 18px' }}
            >
              <Play size={14} aria-hidden="true" />
              <span>
                {isRunning
                  ? 'Testing Stop…'
                  : `Measure Stop #${activeStopIndex + 1} (${route.stops[activeStopIndex].timeLabel})`}
              </span>
            </button>
          ) : (
            <span className="badge" style={{ background: 'var(--pass-quiet)', color: 'var(--pass)', fontSize: 13, padding: '8px 14px' }}>
              Route Complete
            </span>
          )}
        </div>
      </div>

      {/* Live Route Summary Cards (Dynamically computed from actual records) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 12,
        }}
      >
        <div style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block' }}>TOTAL TESTED</span>
          <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)' }}>
            {summary.completedStops} / {summary.totalStops}
          </span>
        </div>
        <div style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block' }}>WITHIN REFERENCE RANGE</span>
          <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: 'var(--pass)' }}>
            {summary.withinReferenceRange}
          </span>
        </div>
        <div style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block' }}>ACTION ALERTS (&gt;LIMIT)</span>
          <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: 'var(--caution)' }}>
            {summary.alertCount}
          </span>
        </div>
        <div style={{ background: 'var(--surface-raised)', padding: '12px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--line)' }}>
          <span style={{ fontSize: 11, color: 'var(--ink-3)', display: 'block' }}>REJECTED BY QC/OOD</span>
          <span className="tnum" style={{ fontSize: 24, fontWeight: 700, color: 'var(--alert)' }}>
            {summary.rejectedCount}
          </span>
        </div>
      </div>

      {/* Sequential Route Stops List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {route.stops.map((stop, idx) => {
          const isDone = idx < completedResults.length;
          const isCurrent = idx === activeStopIndex;
          const result = isDone ? completedResults[idx] : null;

          return (
            <div
              key={stop.stopNumber}
              style={{
                background: isCurrent ? 'var(--surface-sunken)' : 'var(--surface-raised)',
                borderRadius: 'var(--r-md)',
                border: isCurrent ? '1.5px solid var(--accent)' : '1px solid var(--line)',
                padding: '14px 18px',
                display: 'flex',
                alignItems: 'center',
                gap: 16,
              }}
            >
              {/* Time and sequence badge */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 60,
                }}
              >
                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-2)' }}>
                  {stop.timeLabel}
                </span>
                <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Stop #{stop.stopNumber}</span>
              </div>

              {/* Location details */}
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>
                  {stop.locationName}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ink-2)', marginTop: 2 }}>
                  {stop.notes}
                </div>
              </div>

              {/* Status / Output */}
              <div style={{ textAlign: 'right', minWidth: 160 }}>
                {isDone && result ? (
                  result.isRejected ? (
                    <div>
                      <span className="badge" style={{ background: 'var(--alert-quiet)', color: 'var(--alert)' }}>
                        REJECTED
                      </span>
                      <div style={{ fontSize: 11, color: 'var(--alert)', marginTop: 2 }}>
                        Anomaly / Hardware
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="tnum" style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>
                        {result.predictedConcentration?.toFixed(2)} mg P/L
                      </div>
                      <div style={{ fontSize: 11, color: result.predictedConcentration! > stop.targetReferenceMaxMgL ? 'var(--alert)' : 'var(--pass)' }}>
                        {result.predictedConcentration! > stop.targetReferenceMaxMgL ? 'Above limit' : 'Safe / within range'}
                      </div>
                    </div>
                  )
                ) : isCurrent ? (
                  <span className="badge" style={{ background: 'var(--accent-quiet)', color: 'var(--accent)', fontWeight: 600 }}>
                    Up Next
                  </span>
                ) : (
                  <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Pending</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
