import React from 'react';
import { Result, Scenario, analyzeScenario, ConservatismLevel } from '../engine';

interface Props {
  currentScenario: Scenario;
  currentResult: Result;
  allScenarios: Scenario[];
}

export const OperatingPointChart: React.FC<Props> = ({ currentScenario, currentResult, allScenarios }) => {
  // Chart dimensions
  const width = 400;
  const height = 300;
  const margin = { top: 20, right: 30, bottom: 40, left: 50 };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Scales
  // X-axis: Richardson Number (Ri).
  const maxRi = 5;
  const scaleX = (ri: number) => {
    const clamped = Math.min(ri, maxRi);
    return (clamped / maxRi) * innerWidth;
  };

  // Y-axis: Velocity (Vjet). 0 to 2.5 m/s.
  const maxV = 2.5;
  const scaleY = (v: number) => {
    const clamped = Math.min(v, maxV);
    return innerHeight - (clamped / maxV) * innerHeight;
  };

  // Thresholds from Options
  const riThreshold = currentScenario.options.ri_threshold_warn;
  const vThreshold = currentScenario.options.target_velocity_m_s;

  // Data points
  const points = allScenarios.map(s => {
    const res = s.id === currentScenario.id ? currentResult : analyzeScenario(s);
    return {
      x: res.metrics.richardsonNumber,
      y: res.metrics.inletVelocity_m_s,
      status: res.overallStatus,
      isCurrent: s.id === currentScenario.id,
      name: s.name
    };
  });

  const getColor = (status: string) => {
    if (status === 'PASS') return '#22c55e';
    if (status === 'WARN') return '#f97316';
    return '#ef4444';
  };

  return (
    <div className="card flex flex-col items-center">
      <h3 className="text-sm font-bold text-slate-700 mb-2 w-full text-left">Operating Point Map</h3>
      <div className="relative">
        <svg width={width} height={height} className="border border-slate-100 bg-slate-50 rounded">
          <g transform={`translate(${margin.left}, ${margin.top})`}>
            
            {/* Grid Lines */}
            <line x1={0} y1={innerHeight} x2={innerWidth} y2={innerHeight} stroke="#cbd5e1" strokeWidth="1" />
            <line x1={0} y1={0} x2={0} y2={innerHeight} stroke="#cbd5e1" strokeWidth="1" />

            {/* Threshold Bands */}
            {/* Ri = Threshold (Vertical) */}
            <line 
              x1={scaleX(riThreshold)} y1={0} 
              x2={scaleX(riThreshold)} y2={innerHeight} 
              stroke="#94a3b8" strokeDasharray="4,4" strokeWidth="1.5" 
            />
            <text x={scaleX(riThreshold) + 5} y={10} fontSize="10" fill="#64748b">Buoyancy Limit (Ri={riThreshold})</text>

            {/* Vjet Threshold (Horizontal) */}
            <line 
              x1={0} y1={scaleY(vThreshold)} 
              x2={innerWidth} y2={scaleY(vThreshold)} 
              stroke="#94a3b8" strokeDasharray="4,4" strokeWidth="1.5" 
            />
            <text x={5} y={scaleY(vThreshold) - 5} fontSize="10" fill="#64748b">Min Mixing Momentum ({vThreshold} m/s)</text>

            {/* Points */}
            {points.map((p, i) => (
              <g key={i} transform={`translate(${scaleX(p.x)}, ${scaleY(p.y)})`}>
                <circle 
                  r={p.isCurrent ? 6 : 4} 
                  fill={getColor(p.status)} 
                  stroke="white" 
                  strokeWidth="1.5"
                  className="transition-all duration-300"
                />
                {p.isCurrent && (
                  <circle r={8} fill="none" stroke={getColor(p.status)} strokeOpacity="0.5" />
                )}
              </g>
            ))}

            {/* Axes Labels */}
            <text x={innerWidth / 2} y={innerHeight + 30} textAnchor="middle" fontSize="12" fill="#475569">
              Richardson Number (Ri)
            </text>
            <text x={-innerHeight / 2} y={-35} textAnchor="middle" fontSize="12" fill="#475569" transform="rotate(-90)">
              Inlet Velocity (m/s)
            </text>

          </g>
        </svg>
      </div>
      <div className="flex gap-4 mt-2 text-xs text-slate-500">
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500"></span>PASS</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>WARN</div>
        <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>FAIL</div>
      </div>
      <div className="text-[10px] text-slate-400 mt-1 w-full text-center">
        Dashed lines based on configured risk thresholds.
      </div>
    </div>
  );
};