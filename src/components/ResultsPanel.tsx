import React from 'react';
import { Result, Status } from '../engine';

interface Props {
  result: Result;
}

const StatusBadge: React.FC<{ status: Status; label?: string }> = ({ status, label }) => {
  const colors = {
    PASS: 'bg-green-100 text-green-800 border-green-200',
    WARN: 'bg-orange-100 text-orange-800 border-orange-200',
    FAIL: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`badge border px-3 py-1 text-sm font-bold ${colors[status]}`}>
      {label || status}
    </span>
  );
};

// Helper to handle small numbers gracefully
const formatDimensionless = (val: number): string => {
  if (!Number.isFinite(val)) return '∞';
  if (val === 0) return '0';
  if (Math.abs(val) < 0.01) {
    return val.toExponential(2); // e.g. 1.50e-3
  }
  if (val > 100) return val.toFixed(0);
  return val.toPrecision(3); // e.g. 0.456 or 1.23
};

export const ResultsPanel: React.FC<Props> = ({ result }) => {
  return (
    <div className="space-y-6">
      {/* Overall Card */}
      <div className="card border-l-4 border-l-blue-500">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-slate-800">Assessment Result</h2>
          <StatusBadge status={result.overallStatus} label={`OVERALL: ${result.overallStatus}`} />
        </div>
        
        <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded">
            <span className="text-sm font-medium text-slate-600">Vertical Mixing</span>
            <StatusBadge status={result.verticalStatus} />
          </div>
          <div className="flex justify-between items-center bg-slate-50 p-3 rounded">
            <span className="text-sm font-medium text-slate-600">Horizontal Risk</span>
            <StatusBadge status={result.horizontalStatus} />
          </div>
        </div>

        {result.dominantRisk !== 'none' && (
          <div className="mt-3 text-sm text-slate-600">
            <strong>Dominant Risk: </strong> 
            <span className="capitalize">{result.dominantRisk.replace('_', ' ')}</span>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="card">
        <h3 className="section-header">Key Metrics</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          
          {/* Inlet Velocity */}
          <div className="p-2 bg-slate-50 rounded">
            <div className="text-slate-500 text-xs uppercase">Inlet Velocity</div>
            <div className="font-mono font-bold text-lg">{result.metrics.inletVelocity_m_s.toFixed(2)} <span className="text-xs font-normal text-slate-400">m/s</span></div>
          </div>
          
          {/* Froude */}
          <div className="p-2 bg-slate-50 rounded">
            <div className="text-slate-500 text-xs uppercase">Froude (Inlet)</div>
            <div className="font-mono font-bold text-lg">{result.metrics.froudeInlet.toFixed(2)}</div>
          </div>
          
          {/* Richardson (Ri) - Enhanced Display */}
          <div className="p-2 bg-slate-50 rounded border border-slate-200">
            <div className="flex justify-between items-center">
               <div className="text-slate-500 text-xs uppercase">Richardson (Ri)</div>
            </div>
            <div className={`font-mono font-bold text-lg ${result.metrics.richardsonNumber > 1 ? 'text-orange-600' : 'text-slate-800'}`}>
              {formatDimensionless(result.metrics.richardsonNumber)}
            </div>
            {/* Debug Details for Transparency */}
            <div className="mt-1 pt-1 border-t border-slate-200 text-[10px] text-slate-500 font-mono">
              <div>L = {result.metrics.ri_lengthScale_m.toFixed(2)} m</div>
              <div>ΔT = {result.metrics.deltaT_inlet_vs_tank.toFixed(1)} °C</div>
            </div>
          </div>

          {/* Turnover Ratio */}
          <div className="p-2 bg-slate-50 rounded">
            <div className="text-slate-500 text-xs uppercase">Turnover Ratio</div>
            <div className="font-mono font-bold text-lg">{(result.metrics.turnoverRatio * 100).toFixed(1)}<span className="text-xs font-normal text-slate-400">%</span></div>
          </div>
          
          {/* Delta T */}
           <div className="p-2 bg-slate-50 rounded">
            <div className="text-slate-500 text-xs uppercase">Delta T (Max)</div>
            <div className="font-mono font-bold text-lg">{result.metrics.deltaT.toFixed(1)} <span className="text-xs font-normal text-slate-400">°C</span></div>
          </div>
          
          {/* Layout Risk */}
          <div className="p-2 bg-slate-50 rounded">
            <div className="text-slate-500 text-xs uppercase">Layout Risk</div>
            <div className="font-mono font-bold text-lg">{result.metrics.horizontalRiskScore}<span className="text-xs font-normal text-slate-400">/100</span></div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="card border-l-4 border-l-yellow-400">
          <h3 className="section-header text-yellow-800">Recommendations</h3>
          <ul className="space-y-3">
            {result.recommendations.map(rec => (
              <li key={rec.id} className="flex gap-3 text-sm">
                 <span className={`shrink-0 h-2 w-2 mt-1.5 rounded-full ${
                   rec.priority === 'high' ? 'bg-red-500' : rec.priority === 'medium' ? 'bg-orange-400' : 'bg-blue-400'
                 }`} />
                 <span className="text-slate-700">{rec.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Validity Flags */}
      <div className="text-xs text-slate-400 px-4">
        <strong className="block mb-1">Validity Constraints:</strong>
        <ul className="list-disc pl-4 space-y-0.5">
          {result.validityFlags.map((flag, idx) => (
            <li key={idx}>{flag}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
