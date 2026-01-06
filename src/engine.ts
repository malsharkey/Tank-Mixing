/**
 * TIER-1 HYDRAULIC MIXING HEURISTIC ENGINE
 * 
 * This module contains pure functions for evaluating tank mixing risks.
 * Assumptions:
 * - Cylindrical tanks only for MVP.
 * - Newtonian fluid (water).
 * - Simplified buoyancy and momentum flux calculations.
 * - 1 kL = 1 m3.
 */

// --- Types ---

export type ConservatismLevel = 'low' | 'normal' | 'high';
export type Orientation = 'radial' | 'tangential' | 'downward' | 'upward' | 'opposite' | 'unknown';
export type TankShape = 'cylindrical' | 'rectangular';
export type RiLengthScale = 'nozzle' | 'depth_quarter' | 'tank_half';

export interface Tank {
  shape: TankShape;
  diameter_m: number;
  water_depth_m: number;
  operating_storage_kL: number;
  reserve_unusable_kL: number;
}

export interface Inlet {
  count: number;
  elevation_from_floor_m: number;
  nozzle_diameter_mm: number;
  orientation: Orientation;
  inclination_deg: number;
}

export interface Outlet {
  elevation_from_floor_m: number;
  orientation: Orientation;
}

export interface Operation {
  inflow_Lps: number;
  fill_event_volume_kL: number;
  events_per_day: number;
}

export interface Water {
  temperature_inflow_min_C: number;
  temperature_inflow_max_C: number;
  temperature_tank_initial_C: number;
}

export interface Options {
  target_mixed_fraction: number;
  conservatism: ConservatismLevel;
  ri_length_scale: RiLengthScale; // New option for interpretability
  
  // Configurable Risk Thresholds
  target_velocity_m_s: number;
  ri_threshold_warn: number;
  ri_threshold_fail: number;
  tor_threshold_warn: number;
  layout_score_warn: number;
  layout_score_fail: number;

  // Configurable Layout Risk Weights
  risk_vertical_proximity: number;   // e.g. 25
  risk_high_elevation: number;       // e.g. 35
  risk_orient_radial: number;        // e.g. 15
  risk_orient_upward: number;        // e.g. 5
  credit_orient_tangential: number;  // e.g. 10 (subtracted)
  credit_orient_downward: number;    // e.g. 5 (subtracted)
  credit_outlet_opposite: number;    // e.g. 5 (subtracted)
  credit_multiple_inlets: number;    // e.g. 10 (subtracted)
}

export interface Scenario {
  id: string;
  name: string;
  tank: Tank;
  inlet: Inlet;
  outlet: Outlet;
  operation: Operation;
  water: Water;
  options: Options;
}

export type Status = 'PASS' | 'WARN' | 'FAIL';

export interface Metrics {
  inletVelocity_m_s: number;
  froudeInlet: number;
  richardsonNumber: number; // Ri
  turnoverRatio: number; // Based on Total Effective Volume
  jetPenetrationReach: 'upper_layer_only' | 'partial' | 'bottom';
  horizontalRiskScore: number; // 0-100
  deltaT: number; // Backward compat (deltaT_inlet_vs_tank)
  
  // New specific metrics for debugging/UI
  tankVolume_geom_m3: number;
  tankVolume_total_effective_m3: number;
  deltaT_inlet_vs_tank: number;
  deltaT_inlet_range: number;
  
  // Ri Debug Terms
  ri_numerator: number;      // g * beta * dT * L
  ri_denominator: number;    // V^2
  ri_lengthScale_m: number;  // The L used
  beta_per_C: number;
}

export interface Recommendation {
  id: string;
  type: 'design' | 'operation';
  message: string;
  priority: 'high' | 'medium' | 'low';
}

export interface Result {
  overallStatus: Status;
  verticalStatus: Status;
  horizontalStatus: Status;
  metrics: Metrics;
  recommendations: Recommendation[];
  validityFlags: string[];
  dominantRisk: 'buoyancy' | 'short_circuit' | 'insufficient_momentum' | 'none';
}

// --- Constants ---

const G = 9.81; // m/s^2

// --- Helper Functions ---

export const computeNozzleArea = (d_mm: number): number => {
  const d_m = d_mm / 1000;
  return Math.PI * Math.pow(d_m / 2, 2);
};

export const computeTankVolumeCyl = (D_m: number, H_m: number): number => {
  return Math.PI * Math.pow(D_m, 2) / 4 * H_m;
};

export const computeInletVelocity = (flow_Lps: number, area_m2: number, count: number): number => {
  if (area_m2 <= 0 || count <= 0) return 0;
  const flow_m3s = flow_Lps / 1000;
  // Assumes flow is split evenly among inlets
  const flowPerInlet = flow_m3s / count;
  return flowPerInlet / area_m2;
};

export const estimateBetaPerC = (tempC: number): number => {
  // Placeholder: constant for fresh water approx 20C
  // Beta is approx 2.1e-4 1/K at 20C.
  return 2.1e-4; 
};

export const computeFroudeInlet = (Vjet: number, d_nozzle_m: number): number => {
  if (d_nozzle_m <= 0) return 0;
  // Fr = V / sqrt(g * L)
  return Vjet / Math.sqrt(G * d_nozzle_m);
};

export const computeTurnoverRatio = (fillVol_m3: number, tankVol_m3: number): number => {
  if (tankVol_m3 <= 0) return 0;
  return fillVol_m3 / tankVol_m3;
};

// --- Main Engine Logic ---

export const analyzeScenario = (scenario: Scenario): Result => {
  const { tank, inlet, outlet, operation, water, options } = scenario;
  const validityFlags: string[] = [
    "Tier-1 heuristics; not CFD",
    "Cylindrical tank model",
    "Assumes reserve volume participates in mixing",
    "Simplified thermal stratification"
  ];
  const recs: Recommendation[] = [];

  // --- 1. Volume & Geometry Checks ---
  
  // Calculate Geometric Volume (Physical limit)
  const v_geom_m3 = computeTankVolumeCyl(tank.diameter_m, tank.water_depth_m);

  // Calculate Total Effective Volume (Operating + Reserve)
  const v_oper_m3 = Math.max(0, tank.operating_storage_kL);
  const v_reserve_m3 = Math.max(0, tank.reserve_unusable_kL);
  const v_eff_m3 = v_oper_m3 + v_reserve_m3;

  // Consistency Check
  if (v_eff_m3 > v_geom_m3 * 1.01) { 
    validityFlags.push(`Warning: Specified volumes (${v_eff_m3.toFixed(0)}m³) exceed geometric capacity (${v_geom_m3.toFixed(0)}m³).`);
  }
  
  const volumeForTurnover = v_eff_m3 > 0 ? v_eff_m3 : v_geom_m3;
  if (v_eff_m3 <= 0) {
    validityFlags.push("Warning: No operating/reserve storage defined. Using geometric volume for turnover metrics.");
  }

  if (inlet.elevation_from_floor_m > tank.water_depth_m) {
    recs.push({ id: 'err-in-elev', type: 'design', priority: 'high', message: 'Inlet elevation is higher than water depth.' });
  }
  if (outlet.elevation_from_floor_m > tank.water_depth_m) {
    recs.push({ id: 'err-out-elev', type: 'design', priority: 'high', message: 'Outlet elevation is higher than water depth.' });
  }

  // --- 2. Hydraulics & Thermal ---

  const d_noz_m = inlet.nozzle_diameter_mm / 1000;
  const nozzleArea = computeNozzleArea(inlet.nozzle_diameter_mm);
  const Vjet = computeInletVelocity(operation.inflow_Lps, nozzleArea, inlet.count);
  
  const TOR = computeTurnoverRatio(operation.fill_event_volume_kL, volumeForTurnover);
  const Fr = computeFroudeInlet(Vjet, d_noz_m);
  
  const dt_range = Math.abs(water.temperature_inflow_max_C - water.temperature_inflow_min_C);
  const dt_diff_max = Math.abs(water.temperature_inflow_max_C - water.temperature_tank_initial_C);
  const dt_diff_min = Math.abs(water.temperature_inflow_min_C - water.temperature_tank_initial_C);
  const dt_vs_tank = Math.max(dt_diff_max, dt_diff_min);

  const beta = estimateBetaPerC(water.temperature_tank_initial_C);

  // --- 3. Richardson Calculation (Robust) ---

  // Determine Length Scale based on option
  let L_buoyancy = d_noz_m; // default 'nozzle'
  if (options.ri_length_scale === 'depth_quarter') {
    // 25% of depth, clamped between 5cm and 2m for realism
    L_buoyancy = Math.max(0.05, Math.min(2.0, 0.25 * tank.water_depth_m));
  } else if (options.ri_length_scale === 'tank_half') {
    L_buoyancy = Math.min(tank.diameter_m, tank.water_depth_m) / 2;
  }
  // Ensure L is never tiny to prevent singularities (though Vjet usually dominates denominator)
  L_buoyancy = Math.max(L_buoyancy, 0.05);

  let Ri = 0;
  let ri_num = 0;
  let ri_den = 0;

  if (Vjet <= 0.0001) {
    Ri = Number.POSITIVE_INFINITY;
  } else if (dt_vs_tank < 0.01) {
    // Effectively isothermal
    Ri = 0;
    ri_num = 0;
    ri_den = Math.pow(Vjet, 2);
  } else {
    ri_num = G * beta * dt_vs_tank * L_buoyancy;
    ri_den = Math.pow(Vjet, 2);
    Ri = ri_num / ri_den;
  }

  // Validate Numbers (NaN Check)
  if (isNaN(Ri)) {
    Ri = 0;
    validityFlags.push("Error: Calculated Richardson number is NaN. Check input values.");
  }

  // --- 4. Vertical Mixing Status ---
  
  let verticalStatus: Status = 'PASS';
  
  // Velocity Targets
  // Use explicit threshold from options, falling back to 0.8 if undefined (safety)
  const v_target = options.target_velocity_m_s ?? 0.8; 

  // A. Penetration / Elevation Check
  let jetPenetrationReach: Metrics['jetPenetrationReach'] = 'bottom';
  const stableStratLikely = (dt_vs_tank >= 2.0) && (Ri > options.ri_threshold_warn); 
  
  if (stableStratLikely) {
    if (inlet.elevation_from_floor_m > 0.5 * tank.water_depth_m) {
      jetPenetrationReach = 'upper_layer_only';
    } else if (inlet.elevation_from_floor_m > 0.25 * tank.water_depth_m) {
      jetPenetrationReach = 'partial';
    }
  }

  // B. Evaluation Logic
  
  if (Vjet < 0.5 * v_target) {
    verticalStatus = 'FAIL';
    recs.push({
      id: 'vert-mom-fail', type: 'design', priority: 'high',
      message: `Inlet momentum is critically low (${Vjet.toFixed(2)} m/s). Jet likely collapses immediately.`
    });
  } else if (Vjet < v_target) {
    verticalStatus = 'WARN';
    recs.push({
      id: 'vert-mom-warn', type: 'design', priority: 'medium',
      message: `Inlet velocity (${Vjet.toFixed(2)} m/s) is below recommended target (${v_target} m/s) for robust mixing.`
    });
  }

  if (verticalStatus !== 'FAIL') {
    if (jetPenetrationReach === 'upper_layer_only') {
      verticalStatus = 'FAIL';
      recs.push({
        id: 'vert-strat-fail', type: 'design', priority: 'high',
        message: `High inlet elevation with temperature difference risks buoyant stratification.`
      });
    } else if (Ri > options.ri_threshold_fail) {
      verticalStatus = 'FAIL';
      recs.push({
        id: 'vert-ri-fail', type: 'operation', priority: 'high',
        message: `Richardson number is very high (${Ri > 100 ? '>100' : Ri.toFixed(1)} > ${options.ri_threshold_fail}). Buoyancy forces overwhelm mixing.`
      });
    } else if (Ri > options.ri_threshold_warn) {
      verticalStatus = (verticalStatus === 'WARN') ? 'WARN' : 'WARN';
      recs.push({
        id: 'vert-ri-warn', type: 'operation', priority: 'medium',
        message: `Richardson number > ${options.ri_threshold_warn} (${Ri.toFixed(2)}) indicates buoyancy forces are significant.`
      });
    }
  }

  if (TOR < options.tor_threshold_warn && verticalStatus !== 'FAIL') {
    verticalStatus = (verticalStatus === 'PASS') ? 'WARN' : verticalStatus;
    recs.push({
      id: 'vert-tor', type: 'operation', priority: 'low',
      message: `Turnover ratio per fill is low (${(TOR*100).toFixed(1)}% < ${(options.tor_threshold_warn*100).toFixed(0)}%).`
    });
  }

  // --- 5. Horizontal / Layout Status ---

  let hScore = 0;
  const distInOut = Math.abs(inlet.elevation_from_floor_m - outlet.elevation_from_floor_m);
  
  // Use configurable weights
  if (distInOut < 0.15 * tank.water_depth_m) {
    hScore += options.risk_vertical_proximity;
  }
  if (inlet.elevation_from_floor_m > 0.6 * tank.water_depth_m && outlet.elevation_from_floor_m > 0.6 * tank.water_depth_m) {
    hScore += options.risk_high_elevation;
  }

  if (inlet.orientation === 'radial') hScore += options.risk_orient_radial;
  if (inlet.orientation === 'tangential') hScore -= options.credit_orient_tangential;
  if (inlet.orientation === 'downward') hScore -= options.credit_orient_downward;
  if (inlet.orientation === 'upward') hScore += options.risk_orient_upward;
  
  if (outlet.orientation === 'opposite') hScore -= options.credit_outlet_opposite; 
  if (inlet.count >= 2) hScore -= options.credit_multiple_inlets;

  hScore = Math.max(0, Math.min(100, hScore));

  let horizontalStatus: Status = 'PASS';
  if (hScore >= options.layout_score_fail) horizontalStatus = 'FAIL';
  else if (hScore >= options.layout_score_warn) horizontalStatus = 'WARN';

  if (horizontalStatus !== 'PASS') {
    recs.push({
      id: 'horiz-main', type: 'design', priority: 'medium',
      message: `Horizontal layout risk score is ${hScore}/100. ${horizontalStatus === 'FAIL' ? 'Consider baffling or reorienting nozzles.' : ''}`
    });
    if (distInOut < 0.15 * tank.water_depth_m) {
      recs.push({
        id: 'horiz-prox', type: 'design', priority: 'high',
        message: 'Inlet and Outlet are vertically close. Risk of short-circuiting.'
      });
    }
  }

  // --- 6. Recommendations ---
  
  if (Vjet < v_target) {
    const q_m3s = operation.inflow_Lps / 1000;
    const q_per_inlet = q_m3s / Math.max(1, inlet.count);
    const max_d_m = Math.sqrt( (4 * q_per_inlet) / (Math.PI * v_target) );
    recs.push({
      id: 'rec-nozzle', type: 'design', priority: 'high',
      message: `To achieve ${v_target} m/s, reduce nozzle diameter to ~${(max_d_m * 1000).toFixed(0)}mm.`
    });
  }

  if (inlet.elevation_from_floor_m > 0.25 * tank.water_depth_m && verticalStatus !== 'PASS') {
     recs.push({
        id: 'rec-elev', type: 'design', priority: 'high',
        message: `Lower inlet to bottom quarter (<= ${(0.25 * tank.water_depth_m).toFixed(1)}m).`
      });
  }

  // --- 7. Aggregation ---
  
  let overallStatus: Status = 'PASS';
  if (verticalStatus === 'FAIL' || horizontalStatus === 'FAIL') overallStatus = 'FAIL';
  else if (verticalStatus === 'WARN' || horizontalStatus === 'WARN') overallStatus = 'WARN';

  let dominantRisk: Result['dominantRisk'] = 'none';
  if (overallStatus !== 'PASS') {
    if (verticalStatus === 'FAIL' || verticalStatus === 'WARN') {
      if (Vjet < 0.5 * v_target) dominantRisk = 'insufficient_momentum';
      else if (Ri > options.ri_threshold_warn) dominantRisk = 'buoyancy';
      else dominantRisk = 'insufficient_momentum';
    } else {
      dominantRisk = 'short_circuit';
    }
  }

  return {
    overallStatus,
    verticalStatus,
    horizontalStatus,
    metrics: {
      inletVelocity_m_s: Vjet,
      froudeInlet: Fr,
      richardsonNumber: Ri,
      turnoverRatio: TOR,
      jetPenetrationReach,
      horizontalRiskScore: hScore,
      deltaT: dt_vs_tank,
      tankVolume_geom_m3: v_geom_m3,
      tankVolume_total_effective_m3: v_eff_m3,
      deltaT_inlet_vs_tank: dt_vs_tank,
      deltaT_inlet_range: dt_range,
      
      // Debug
      ri_numerator: ri_num,
      ri_denominator: ri_den,
      ri_lengthScale_m: L_buoyancy,
      beta_per_C: beta
    },
    recommendations: recs,
    validityFlags,
    dominantRisk
  };
};

export interface SanityCheckResult {
  name: string;
  pass: boolean;
  detail: string;
}

export const runEngineSanityChecks = (): SanityCheckResult[] => {
  const base = createDefaultScenario();
  // Ensure we use a length scale that allows variation for robustness (e.g. depth based or nozzle based, logic holds for both if parameters isolate)
  // We'll stick to default behavior.
  const results: SanityCheckResult[] = [];

  // Check 1: Increasing Nozzle Diameter -> Reduces Velocity
  const s1 = JSON.parse(JSON.stringify(base)) as Scenario;
  s1.inlet.nozzle_diameter_mm = 300; 
  const rBase = analyzeScenario(base);
  const r1 = analyzeScenario(s1);
  results.push({
    name: 'Increase Nozzle Diam -> Reduce Velocity',
    pass: r1.metrics.inletVelocity_m_s < rBase.metrics.inletVelocity_m_s,
    detail: `${base.inlet.nozzle_diameter_mm}mm (${rBase.metrics.inletVelocity_m_s.toFixed(2)} m/s) -> ${s1.inlet.nozzle_diameter_mm}mm (${r1.metrics.inletVelocity_m_s.toFixed(2)} m/s)`
  });

  // Check 2: Increasing DeltaT -> Increases Ri (assuming Vjet constant)
  const s2 = JSON.parse(JSON.stringify(base)) as Scenario;
  s2.water.temperature_inflow_min_C = 10; // Increase deltaT
  const r2 = analyzeScenario(s2);
  results.push({
    name: 'Increase DeltaT -> Increase Ri',
    pass: r2.metrics.richardsonNumber > rBase.metrics.richardsonNumber,
    detail: `dT=${rBase.metrics.deltaT_inlet_vs_tank.toFixed(1)} (Ri=${rBase.metrics.richardsonNumber.toExponential(2)}) -> dT=${r2.metrics.deltaT_inlet_vs_tank.toFixed(1)} (Ri=${r2.metrics.richardsonNumber.toExponential(2)})`
  });

  // Check 3: Increasing Length Scale -> Increases Ri
  const s3 = JSON.parse(JSON.stringify(base)) as Scenario;
  s3.options.ri_length_scale = 'tank_half'; // Usually larger than nozzle
  // Ensure tank dim allows this
  s3.tank.diameter_m = 20; 
  s3.tank.water_depth_m = 20;
  // base is nozzle (0.15m). tank_half is 10m.
  const r3 = analyzeScenario(s3);
  // Need to compare against s3 running with nozzle scale
  const s3_base = JSON.parse(JSON.stringify(s3)) as Scenario;
  s3_base.options.ri_length_scale = 'nozzle';
  const r3_base = analyzeScenario(s3_base);
  
  results.push({
    name: 'Increase Length Scale -> Increase Ri',
    pass: r3.metrics.richardsonNumber > r3_base.metrics.richardsonNumber,
    detail: `L=${r3_base.metrics.ri_lengthScale_m.toFixed(2)}m (Ri=${r3_base.metrics.richardsonNumber.toExponential(2)}) -> L=${r3.metrics.ri_lengthScale_m.toFixed(2)}m (Ri=${r3.metrics.richardsonNumber.toExponential(2)})`
  });

  return results;
};

export const createDefaultScenario = (): Scenario => ({
  id: 'default-1',
  name: 'Baseline Scenario',
  tank: {
    shape: 'cylindrical',
    diameter_m: 10,
    water_depth_m: 5,
    operating_storage_kL: 350,
    reserve_unusable_kL: 40
  },
  inlet: {
    count: 1,
    elevation_from_floor_m: 0.5,
    nozzle_diameter_mm: 150,
    orientation: 'radial',
    inclination_deg: 0
  },
  outlet: {
    elevation_from_floor_m: 0.2,
    orientation: 'opposite'
  },
  operation: {
    inflow_Lps: 20,
    fill_event_volume_kL: 100,
    events_per_day: 1
  },
  water: {
    temperature_inflow_min_C: 15,
    temperature_inflow_max_C: 18,
    temperature_tank_initial_C: 22
  },
  options: {
    target_mixed_fraction: 0.95,
    conservatism: 'normal',
    ri_length_scale: 'depth_quarter',
    // New defaults
    target_velocity_m_s: 0.8,
    ri_threshold_warn: 1.0,
    ri_threshold_fail: 5.0,
    tor_threshold_warn: 0.3,
    layout_score_warn: 30,
    layout_score_fail: 65,
    
    // Layout Risks Defaults
    risk_vertical_proximity: 25,
    risk_high_elevation: 35,
    risk_orient_radial: 15,
    risk_orient_upward: 5,
    credit_orient_tangential: 10,
    credit_orient_downward: 5,
    credit_outlet_opposite: 5,
    credit_multiple_inlets: 10
  }
});