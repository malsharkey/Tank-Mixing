import React, { useState } from 'react';
import { Scenario, Tank, Inlet, Outlet, Operation, Water, Options, computeTankVolumeCyl, ConservatismLevel } from '../engine';

interface Props {
  scenario: Scenario;
  onUpdate: (updated: Scenario) => void;
}

type Tab = 'Tank' | 'Inlet' | 'Outlet' | 'Operation' | 'Water' | 'Options';

// Helper type to define sections of Scenario that are objects (excluding id and name strings)
type ScenarioObjectSection = Exclude<keyof Scenario, 'id' | 'name'>;

export const ScenarioForm: React.FC<Props> = ({ scenario, onUpdate }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Tank');

  const updateField = <T extends ScenarioObjectSection>(section: T, field: keyof Scenario[T], value: any) => {
    onUpdate({
      ...scenario,
      [section]: {
        ...scenario[section],
        [field]: value
      }
    });
  };

  const handleNumChange = (section: ScenarioObjectSection, field: string, value: string) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      (updateField as any)(section, field, num);
    }
  };

  const tabs: Tab[] = ['Tank', 'Inlet', 'Outlet', 'Operation', 'Water', 'Options'];

  return (
    <div className="flex flex-col h-full bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap focus:outline-none transition-colors ${
              activeTab === tab
                ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        {/* TANK TAB */}
        {activeTab === 'Tank' && (
          <div className="space-y-6">
            <h3 className="section-header">Tank Geometry</h3>
            
            {/* Diameter */}
            <div>
              <label className="input-label">Diameter (m)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="input-field"
                value={scenario.tank.diameter_m}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                     const newVol = computeTankVolumeCyl(val, scenario.tank.water_depth_m);
                     const newReserve = Math.max(0, newVol - scenario.tank.operating_storage_kL);
                     onUpdate({
                       ...scenario,
                       tank: { 
                         ...scenario.tank, 
                         diameter_m: val,
                         reserve_unusable_kL: parseFloat(newReserve.toFixed(2))
                       }
                     });
                  }
                }}
              />
            </div>

            {/* Water Depth + Total Volume Display */}
            <div>
              <label className="input-label">Water Depth (m)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="input-field"
                value={scenario.tank.water_depth_m}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!isNaN(val)) {
                     const newVol = computeTankVolumeCyl(scenario.tank.diameter_m, val);
                     const newReserve = Math.max(0, newVol - scenario.tank.operating_storage_kL);
                     onUpdate({
                       ...scenario,
                       tank: { 
                         ...scenario.tank, 
                         water_depth_m: val,
                         reserve_unusable_kL: parseFloat(newReserve.toFixed(2))
                       }
                     });
                  }
                }}
              />
              <div className="mt-2 p-3 bg-slate-50 rounded border border-slate-200 text-sm">
                 <span className="text-slate-500 font-medium">Total Geometric Volume:</span>
                 <div className="font-mono font-bold text-slate-800 text-lg">
                   {computeTankVolumeCyl(scenario.tank.diameter_m, scenario.tank.water_depth_m).toFixed(1)} <span className="text-sm font-normal text-slate-500">m³ (kL)</span>
                 </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Operating Storage */}
              <div>
                <label className="input-label">Op. Storage (kL)</label>
                <input
                  type="number"
                  min="0"
                  className="input-field"
                  value={scenario.tank.operating_storage_kL}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                       const totalVol = computeTankVolumeCyl(scenario.tank.diameter_m, scenario.tank.water_depth_m);
                       const newReserve = Math.max(0, totalVol - val);
                       onUpdate({
                         ...scenario,
                         tank: { 
                           ...scenario.tank, 
                           operating_storage_kL: val,
                           reserve_unusable_kL: parseFloat(newReserve.toFixed(2))
                         }
                       });
                    }
                  }}
                />
              </div>

              {/* Unusable Volume (Computed/Read-only) */}
              <div>
                <label className="input-label">Unusable Vol (kL)</label>
                <input
                  type="number"
                  className="input-field bg-slate-100 text-slate-500 cursor-not-allowed"
                  value={scenario.tank.reserve_unusable_kL}
                  disabled
                  title="Calculated as Total Volume - Operating Storage"
                />
              </div>
            </div>
            
            <div className="text-xs text-slate-500 mt-2 italic">
              * Unusable Volume is automatically calculated as the remainder of geometric volume.
            </div>
          </div>
        )}

        {/* INLET TAB */}
        {activeTab === 'Inlet' && (
          <div className="space-y-6">
            <h3 className="section-header">Inlet Configuration</h3>
            <div>
              <label className="input-label">Count</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={scenario.inlet.count}
                onChange={(e) => handleNumChange('inlet', 'count', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Elevation from Floor (m)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="input-field"
                value={scenario.inlet.elevation_from_floor_m}
                onChange={(e) => handleNumChange('inlet', 'elevation_from_floor_m', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Nozzle Diameter (mm)</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={scenario.inlet.nozzle_diameter_mm}
                onChange={(e) => handleNumChange('inlet', 'nozzle_diameter_mm', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Orientation</label>
              <select
                className="input-field"
                value={scenario.inlet.orientation}
                onChange={(e) => updateField('inlet', 'orientation', e.target.value)}
              >
                <option value="radial">Radial (Center-pointing)</option>
                <option value="tangential">Tangential (Swirl)</option>
                <option value="upward">Upward (Vertical)</option>
                <option value="downward">Downward</option>
              </select>
            </div>
          </div>
        )}

        {/* OUTLET TAB */}
        {activeTab === 'Outlet' && (
          <div className="space-y-6">
            <h3 className="section-header">Outlet Configuration</h3>
            <div>
              <label className="input-label">Elevation from Floor (m)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                className="input-field"
                value={scenario.outlet.elevation_from_floor_m}
                onChange={(e) => handleNumChange('outlet', 'elevation_from_floor_m', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Orientation</label>
              <select
                className="input-field"
                value={scenario.outlet.orientation}
                onChange={(e) => updateField('outlet', 'orientation', e.target.value)}
              >
                <option value="opposite">Opposite Inlet</option>
                <option value="radial">Radial</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        )}

        {/* OPERATION TAB */}
        {activeTab === 'Operation' && (
          <div className="space-y-6">
            <h3 className="section-header">Operational Parameters</h3>
            <div>
              <label className="input-label">Inflow Rate (L/s)</label>
              <input
                type="number"
                min="0.1"
                className="input-field"
                value={scenario.operation.inflow_Lps}
                onChange={(e) => handleNumChange('operation', 'inflow_Lps', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Fill Event Volume (kL)</label>
              <input
                type="number"
                min="1"
                className="input-field"
                value={scenario.operation.fill_event_volume_kL}
                onChange={(e) => handleNumChange('operation', 'fill_event_volume_kL', e.target.value)}
              />
            </div>
            <div>
              <label className="input-label">Fill Events Per Day</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="input-field"
                value={scenario.operation.events_per_day}
                onChange={(e) => handleNumChange('operation', 'events_per_day', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* WATER TAB */}
        {activeTab === 'Water' && (
          <div className="space-y-6">
            <h3 className="section-header">Water & Temperature</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="input-label">Min Inflow Temp (°C)</label>
                <input
                  type="number"
                  className="input-field"
                  value={scenario.water.temperature_inflow_min_C}
                  onChange={(e) => handleNumChange('water', 'temperature_inflow_min_C', e.target.value)}
                />
              </div>
              <div>
                <label className="input-label">Max Inflow Temp (°C)</label>
                <input
                  type="number"
                  className="input-field"
                  value={scenario.water.temperature_inflow_max_C}
                  onChange={(e) => handleNumChange('water', 'temperature_inflow_max_C', e.target.value)}
                />
              </div>
            </div>
            <div>
              <label className="input-label">Initial Tank Temp (°C)</label>
              <input
                type="number"
                className="input-field"
                value={scenario.water.temperature_tank_initial_C}
                onChange={(e) => handleNumChange('water', 'temperature_tank_initial_C', e.target.value)}
              />
            </div>
          </div>
        )}

        {/* OPTIONS TAB */}
        {activeTab === 'Options' && (
          <div className="space-y-6">
            <h3 className="section-header">Analysis Options</h3>
            <div>
              <label className="input-label">Target Mixed Fraction</label>
              <input
                type="number"
                min="0.5"
                max="1.0"
                step="0.01"
                className="input-field"
                value={scenario.options.target_mixed_fraction}
                onChange={(e) => handleNumChange('options', 'target_mixed_fraction', e.target.value)}
              />
            </div>

            <div>
              <label className="input-label">Velocity Preset (Conservatism)</label>
              <select
                className="input-field"
                value={scenario.options.conservatism}
                onChange={(e) => {
                  const level = e.target.value as ConservatismLevel;
                  let v = 0.8;
                  if (level === 'low') v = 0.6;
                  if (level === 'high') v = 1.0;
                  onUpdate({
                    ...scenario,
                    options: {
                      ...scenario.options,
                      conservatism: level,
                      target_velocity_m_s: v
                    }
                  });
                }}
              >
                <option value="low">Low (0.6 m/s)</option>
                <option value="normal">Normal (0.8 m/s)</option>
                <option value="high">High (1.0 m/s)</option>
              </select>
            </div>
            
            <div>
              <label className="input-label">Target Velocity (m/s)</label>
              <input
                type="number"
                min="0.1"
                step="0.1"
                className="input-field"
                value={scenario.options.target_velocity_m_s}
                onChange={(e) => handleNumChange('options', 'target_velocity_m_s', e.target.value)}
              />
              <p className="text-xs text-slate-500 mt-1">
                Minimum inlet velocity for mixing. Below 50% of this is a FAIL.
              </p>
            </div>
            
            <div>
              <label className="input-label">Ri Length Scale Definition</label>
              <select
                className="input-field"
                value={scenario.options.ri_length_scale}
                onChange={(e) => updateField('options', 'ri_length_scale', e.target.value)}
              >
                <option value="depth_quarter">Depth Scale (Bulk Stability)</option>
                <option value="nozzle">Nozzle Scale (Jet Stability)</option>
                <option value="tank_half">Tank Scale (Conservative)</option>
              </select>
            </div>

            {/* Risk Thresholds Sub-section */}
            <div className="pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Analysis Thresholds</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Ri Warn Threshold</label>
                    <input
                      type="number" step="0.1"
                      className="input-field"
                      value={scenario.options.ri_threshold_warn}
                      onChange={(e) => handleNumChange('options', 'ri_threshold_warn', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Ri Fail Threshold</label>
                    <input
                      type="number" step="0.1"
                      className="input-field"
                      value={scenario.options.ri_threshold_fail}
                      onChange={(e) => handleNumChange('options', 'ri_threshold_fail', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Min Turnover Ratio</label>
                    <input
                      type="number" step="0.05"
                      className="input-field"
                      value={scenario.options.tor_threshold_warn}
                      onChange={(e) => handleNumChange('options', 'tor_threshold_warn', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Layout Risk Warn</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.layout_score_warn}
                      onChange={(e) => handleNumChange('options', 'layout_score_warn', e.target.value)}
                    />
                  </div>
               </div>
            </div>

            {/* Layout Risk Weights Sub-section */}
            <div className="pt-4 border-t border-slate-100">
               <h4 className="text-sm font-bold text-slate-800 uppercase tracking-wide mb-3">Layout Risk Components</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="input-label">Short-Circuit Risk (+)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.risk_vertical_proximity}
                      onChange={(e) => handleNumChange('options', 'risk_vertical_proximity', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Stagnation Risk (+)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.risk_high_elevation}
                      onChange={(e) => handleNumChange('options', 'risk_high_elevation', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Radial Inlet Risk (+)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.risk_orient_radial}
                      onChange={(e) => handleNumChange('options', 'risk_orient_radial', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Upward Inlet Risk (+)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.risk_orient_upward}
                      onChange={(e) => handleNumChange('options', 'risk_orient_upward', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Tangential Credit (-)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.credit_orient_tangential}
                      onChange={(e) => handleNumChange('options', 'credit_orient_tangential', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Downward Credit (-)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.credit_orient_downward}
                      onChange={(e) => handleNumChange('options', 'credit_orient_downward', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Opposite Outlet Credit (-)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.credit_outlet_opposite}
                      onChange={(e) => handleNumChange('options', 'credit_outlet_opposite', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="input-label">Multi-Inlet Credit (-)</label>
                    <input
                      type="number" step="1"
                      className="input-field"
                      value={scenario.options.credit_multiple_inlets}
                      onChange={(e) => handleNumChange('options', 'credit_multiple_inlets', e.target.value)}
                    />
                  </div>
               </div>

               {/* EXPLANATORY TEXT FOR LAYOUT RISK */}
               <div className="mt-4 p-4 bg-slate-50 rounded border border-slate-200 text-xs text-slate-600 space-y-2 leading-relaxed">
                 <p className="font-bold text-slate-700">How Layout Risk is Calculated:</p>
                 <p>
                   The Horizontal Risk Score (0-100) evaluates the potential for short-circuiting and dead zones based on geometry.
                   The base score is 0. <strong>Risks (+)</strong> increase the score (worse), while <strong>Credits (-)</strong> decrease the score (better).
                 </p>
                 <ul className="list-disc pl-4 space-y-1 mt-2 mb-2">
                   <li><strong>Short-Circuit:</strong> Penalizes if inlet and outlet are vertically close (within 15% of depth).</li>
                   <li><strong>Stagnation:</strong> Penalizes if both inlet and outlet are high in the tank ({'>'}60% depth).</li>
                   <li><strong>Orientation:</strong> Radial/Upward layouts generally mix less effectively than Tangential/Downward configurations.</li>
                   <li><strong>Credits:</strong> Placing the outlet opposite the inlet or using multiple inlets improves distribution.</li>
                 </ul>
                 <p className="italic border-t border-slate-200 pt-2">
                   Final Score = Clamped(Sum of active risks - Sum of active credits, 0, 100). Scores above {scenario.options.layout_score_warn} trigger a warning.
                 </p>
               </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};