// NEC Article 220 residential electrical load calculator.
// Implements both the Standard Method (Part III) and the Optional Method
// (220.82) for existing-dwelling retrofit assessments. Wisconsin SPS 316
// adopts NEC with state amendments; the notes emitted here reflect that.
//
// Philosophy: the app is used to plan heat-pump / HPWH / EV retrofits and
// should prefer smart-panel / load-management alternatives over full panel
// upgrades whenever possible.

// Heat-pump tonnage → watts / MCA / MOCP defaults. MCA and MOCP shown in the
// UI as an informational block; they don't enter the load total directly.
export const HEAT_PUMP_TONNAGE = {
  1:   { watts: 1800,  mca: 12, mocp: 15 },
  1.5: { watts: 2500,  mca: 15, mocp: 20 },
  2:   { watts: 3500,  mca: 20, mocp: 25 },
  2.5: { watts: 4200,  mca: 25, mocp: 30 },
  3:   { watts: 5000,  mca: 30, mocp: 40 },
  3.5: { watts: 5800,  mca: 33, mocp: 45 },
  4:   { watts: 6500,  mca: 37, mocp: 45 },
  5:   { watts: 8500,  mca: 44, mocp: 60 },
};

export const SMART_PANEL_DEFAULTS = {
  span:      { savings: 20, cost: '$3,500–$6,000', bestFor: 'Full panel replacement, solar+battery' },
  neocharge: { savings: 10, cost: '$300–$500',     bestFor: 'Share one 240V circuit between two appliances' },
  emporia:   { savings: 15, cost: '$30–$50/breaker', bestFor: 'Monitoring and load awareness on a budget' },
  lumin:     { savings: 18, cost: '$3,000–$5,000', bestFor: 'Solar+battery, backup power management' },
  other:     { savings: 15, cost: 'Varies',        bestFor: 'Other load management solution' },
};

// Standard residential panel sizes (amps) — used to recommend upgrades.
export const STANDARD_PANEL_SIZES = [60, 100, 125, 150, 200, 225, 320, 400];

// ─── Default starting values for a typical Wisconsin home ──────────────────
export function defaultPanelInfo() {
  return {
    panelRating: 100,
    voltage: 240,
    homeSquareFootage: 1500,
    yearBuilt: 1990,
    dwellingType: 'single-family',
  };
}

export function defaultExistingLoads() {
  return {
    smallApplianceCircuits: 2,
    laundryCircuits: 1,
    rangeWatts: 12000,
    ovenWatts: 0,
    cooktopWatts: 0,
    dishwasherWatts: 1200,
    disposalWatts: 600,
    microwaveWatts: 1500,
    dryerWatts: 5000,
    dryerType: 'electric',
    waterHeaterWatts: 4500,
    waterHeaterType: 'electric-tank',
    existingHeatingWatts: 0,
    existingHeatingType: 'gas-furnace',
    existingCoolingWatts: 3500,
    existingCoolingType: 'central-ac',
    throughWallACVoltage: 208,
    throughWallACAmps: 20,
    throughWallACWatts: 2500,
    evChargerWatts: 0,
    poolPumpWatts: 0,
    hotTubWatts: 0,
    otherFixedLoads: [],
  };
}

export function defaultProposed() {
  const hp = HEAT_PUMP_TONNAGE[3];
  return {
    installHeatPump: true,
    heatPumpType: 'ducted',
    heatPumpTons: 3,
    heatPumpWatts: hp.watts,
    heatPumpMCA: hp.mca,
    heatPumpMOCP: hp.mocp,
    supplementalHeatWatts: 5000,
    installHPWH: false,
    hpwhWatts: 1800,
    hpwhBreaker: 15,
    hpwhVoltage: 240,
    removingExistingHeating: true,
    removingExistingCooling: true,
    removingExistingWaterHeater: false,
    useSmartPanel: false,
    smartPanelType: 'span',
    smartPanelSavingsPercent: 20,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function clamp(n, min = 0) { return Number.isFinite(n) && n > min ? n : min; }
function vaToAmps(va, voltage) { return voltage > 0 ? va / voltage : 0; }

// Standard Method helpers (NEC 220 Part III)

// 220.41 / 220.42 / 220.52 — general lighting + small appliance + laundry,
// combined and demand-factored per Table 220.42(A).
function standardGeneralLoadsVA(panel, loads) {
  const lightingVA = clamp(panel.homeSquareFootage) * 3;
  const smallAppVA = Math.max(loads.smallApplianceCircuits || 0, 2) * 1500;
  const laundryVA  = Math.max(loads.laundryCircuits || 0, 1) * 1500;
  const connected  = lightingVA + smallAppVA + laundryVA;

  let demand;
  if (connected <= 3000) {
    demand = connected;
  } else if (connected <= 120000) {
    demand = 3000 + (connected - 3000) * 0.35;
  } else {
    demand = 3000 + (120000 - 3000) * 0.35 + (connected - 120000) * 0.25;
  }
  return { connected, demand, lightingVA, smallAppVA, laundryVA };
}

// 220.53 — fixed appliances: four or more on the same feeder get a 75% demand
// factor applied to the total. This deliberately does not include cooking,
// dryer, HVAC or water heater counts if they have their own 220.5x line item
// — here we follow common practice and include water heater + EV + pool +
// hot tub + other as fixed appliances alongside dishwasher/disposal/microwave.
function standardFixedAppliancesVA(loads) {
  const items = [
    { name: 'Dishwasher',   va: clamp(loads.dishwasherWatts) },
    { name: 'Disposal',     va: clamp(loads.disposalWatts) },
    { name: 'Microwave',    va: clamp(loads.microwaveWatts) },
  ];
  if (loads.waterHeaterType !== 'none' && loads.waterHeaterType !== 'gas') {
    items.push({ name: 'Water heater', va: clamp(loads.waterHeaterWatts) });
  }
  if (loads.evChargerWatts > 0) items.push({ name: 'EV charger',  va: clamp(loads.evChargerWatts) });
  if (loads.poolPumpWatts  > 0) items.push({ name: 'Pool pump',   va: clamp(loads.poolPumpWatts) });
  if (loads.hotTubWatts    > 0) items.push({ name: 'Hot tub',     va: clamp(loads.hotTubWatts) });
  (loads.otherFixedLoads || []).forEach(o => {
    if (o.watts > 0) items.push({ name: o.name || 'Other', va: clamp(o.watts) });
  });

  const present = items.filter(i => i.va > 0);
  const connected = present.reduce((s, i) => s + i.va, 0);
  const demand = present.length >= 4 ? connected * 0.75 : connected;
  return { connected, demand, items: present };
}

// Table 220.55 — household cooking. Simplified: combined range up to 12kW →
// 8kW; above 12kW, +5% per additional kW. Separate cooktop+oven: sum at 80%.
function standardCookingVA(loads) {
  const rangeKW    = clamp(loads.rangeWatts) / 1000;
  const cooktopKW  = clamp(loads.cooktopWatts) / 1000;
  const ovenKW     = clamp(loads.ovenWatts) / 1000;
  const separateKW = cooktopKW + ovenKW;

  let demandKW = 0;
  let connectedKW = rangeKW + separateKW;

  if (rangeKW > 0) {
    if (rangeKW <= 12) demandKW += 8;
    else demandKW += 8 * (1 + 0.05 * Math.ceil(rangeKW - 12));
  }
  if (separateKW > 0) {
    demandKW += separateKW * 0.8;
  }

  return { connected: connectedKW * 1000, demand: demandKW * 1000 };
}

// 220.54 — dryer: nameplate or 5 kW, whichever is greater. Gas/none = 0.
function standardDryerVA(loads) {
  if (loads.dryerType !== 'electric') return { connected: 0, demand: 0 };
  const nameplate = clamp(loads.dryerWatts);
  const connected = nameplate;
  const demand = Math.max(nameplate, 5000);
  return { connected, demand };
}

// 220.60 noncoincident — use the larger of heating vs cooling.
// Heat pump + supplemental strip heat count as one heating load.
function standardHVACVA(loads, proposed, scenario) {
  const existingHeating = (loads.existingHeatingType === 'none' ||
                           loads.existingHeatingType === 'gas-furnace' ||
                           loads.existingHeatingType === 'oil-furnace')
    ? 0 : clamp(loads.existingHeatingWatts);
  const existingCooling = loads.existingCoolingType === 'none'
    ? 0 : clamp(loads.existingCoolingWatts);

  let heating = existingHeating;
  let cooling = existingCooling;

  if (scenario === 'proposed') {
    if (proposed.removingExistingHeating) heating = 0;
    if (proposed.removingExistingCooling) cooling = 0;
    if (proposed.installHeatPump) {
      const hpWatts = clamp(proposed.heatPumpWatts);
      heating += hpWatts + clamp(proposed.supplementalHeatWatts);
      cooling += hpWatts;
    }
  }

  const larger = Math.max(heating, cooling);
  const driver = heating >= cooling ? 'heating' : 'cooling';
  return { connected: larger, demand: larger, heating, cooling, driver };
}

// 220.50 / 430.24 — largest motor adder: 25% of the largest motor load. The
// HVAC compressor (heat pump or AC) typically qualifies.
function largestMotorAdder(hvac) {
  // Treat the HVAC cooling/compressor side as the largest motor.
  return 0.25 * hvac.cooling;
}

// ─── HPWH helper ──────────────────────────────────────────────────────────
function hpwhDemand(proposed, scenario) {
  if (scenario !== 'proposed' || !proposed.installHPWH) return 0;
  return clamp(proposed.hpwhWatts);
}

// ─── Standard Method total ────────────────────────────────────────────────
function runStandard(panel, loads, proposed, scenario) {
  // In the "proposed" scenario, existing equipment flagged for removal is
  // dropped from the fixed-appliance list.
  const effLoads = { ...loads };
  if (scenario === 'proposed') {
    if (proposed.removingExistingWaterHeater) {
      effLoads.waterHeaterType = 'none';
      effLoads.waterHeaterWatts = 0;
    }
  }

  const general   = standardGeneralLoadsVA(panel, effLoads);
  const fixed     = standardFixedAppliancesVA(effLoads);
  const cooking   = standardCookingVA(effLoads);
  const dryer     = standardDryerVA(effLoads);
  const hvac      = standardHVACVA(effLoads, proposed, scenario);
  const hpwhVA    = hpwhDemand(proposed, scenario);
  const motor     = largestMotorAdder(hvac);

  const totalVA = general.demand + fixed.demand + cooking.demand +
                  dryer.demand + hvac.demand + hpwhVA + motor;

  const categories = [
    { key: 'general',  label: 'General Lighting & Receptacles', connected: general.connected, demand: general.demand, nec: '220.41, 220.42, 220.52' },
    { key: 'fixed',    label: 'Fixed Appliances',               connected: fixed.connected,   demand: fixed.demand,   nec: '220.53', detail: fixed.items },
    { key: 'cooking',  label: 'Cooking Equipment',              connected: cooking.connected, demand: cooking.demand, nec: 'Table 220.55' },
    { key: 'dryer',    label: 'Clothes Dryer',                  connected: dryer.connected,   demand: dryer.demand,   nec: '220.54' },
    { key: 'hvac',     label: `HVAC (noncoincident, ${hvac.driver})`, connected: hvac.connected, demand: hvac.demand, nec: '220.60' },
    { key: 'hpwh',     label: 'Heat Pump Water Heater',         connected: hpwhVA,            demand: hpwhVA,         nec: '422.10' },
    { key: 'motor',    label: 'Largest Motor 25% Adder',        connected: hvac.cooling,      demand: motor,          nec: '220.50, 430.24' },
  ];

  return {
    method: 'standard',
    totalVA,
    amps: vaToAmps(totalVA, panel.voltage),
    categories: categories.filter(c => c.demand > 0 || c.connected > 0),
  };
}

// ─── Optional Method (NEC 220.82) ─────────────────────────────────────────
// Non-HVAC loads: first 10 kVA at 100%, remainder at 40%.
// HVAC: larger of heating vs cooling at 100%.
function runOptional(panel, loads, proposed, scenario) {
  const effLoads = { ...loads };
  if (scenario === 'proposed') {
    if (proposed.removingExistingWaterHeater) {
      effLoads.waterHeaterType = 'none';
      effLoads.waterHeaterWatts = 0;
    }
  }

  // Sum of all non-HVAC loads at nameplate/connected.
  const lighting      = clamp(panel.homeSquareFootage) * 3;
  const smallApp      = Math.max(effLoads.smallApplianceCircuits || 0, 2) * 1500;
  const laundry       = Math.max(effLoads.laundryCircuits || 0, 1) * 1500;
  const cooking       = clamp(effLoads.rangeWatts) + clamp(effLoads.cooktopWatts) + clamp(effLoads.ovenWatts);
  const dryer         = effLoads.dryerType === 'electric' ? Math.max(clamp(effLoads.dryerWatts), 5000) : 0;
  const waterHeater   = (effLoads.waterHeaterType !== 'none' && effLoads.waterHeaterType !== 'gas')
                          ? clamp(effLoads.waterHeaterWatts) : 0;
  const appliances    = clamp(effLoads.dishwasherWatts) + clamp(effLoads.disposalWatts) + clamp(effLoads.microwaveWatts);
  const ev            = clamp(effLoads.evChargerWatts);
  const pool          = clamp(effLoads.poolPumpWatts);
  const hotTub        = clamp(effLoads.hotTubWatts);
  const otherFixed    = (effLoads.otherFixedLoads || []).reduce((s, o) => s + clamp(o.watts), 0);
  const hpwh          = hpwhDemand(proposed, scenario);

  const nonHVACConnected = lighting + smallApp + laundry + cooking + dryer +
                           waterHeater + appliances + ev + pool + hotTub +
                           otherFixed + hpwh;

  const nonHVACDemand = nonHVACConnected <= 10000
    ? nonHVACConnected
    : 10000 + (nonHVACConnected - 10000) * 0.4;

  const hvac = standardHVACVA(effLoads, proposed, scenario);

  const totalVA = nonHVACDemand + hvac.demand;

  const categories = [
    { key: 'general',  label: 'General Loads (220.82(B))', connected: nonHVACConnected, demand: nonHVACDemand, nec: '220.82(B)' },
    { key: 'hvac',     label: `HVAC at 100% (${hvac.driver})`, connected: hvac.connected, demand: hvac.demand, nec: '220.82(C)' },
  ];

  return {
    method: 'optional',
    totalVA,
    amps: vaToAmps(totalVA, panel.voltage),
    categories,
    // Optional method only applies when existing service is 100A+.
    eligible: panel.panelRating >= 100,
  };
}

// ─── Status + smart-panel helpers ─────────────────────────────────────────
export function utilization(amps, panelRating) {
  if (!panelRating) return 0;
  return (amps / panelRating) * 100;
}

export function statusFor(amps, panelRating) {
  const pct = utilization(amps, panelRating);
  if (pct > 100) return { level: 'fail',    label: 'Over Capacity' };
  if (pct > 80)  return { level: 'warning', label: 'Near Limit' };
  return           { level: 'pass',    label: 'Sufficient' };
}

export function recommendedPanelSize(amps) {
  // Smallest standard size whose 80% limit still covers the actual draw.
  for (const size of STANDARD_PANEL_SIZES) {
    if (amps <= size * 0.8) return size;
  }
  return STANDARD_PANEL_SIZES[STANDARD_PANEL_SIZES.length - 1];
}

function smartPanelVariant(result, proposed) {
  if (!proposed.useSmartPanel) return null;
  const savings = clamp(proposed.smartPanelSavingsPercent) / 100;
  const reducedVA = result.totalVA * (1 - savings);
  return {
    ...result,
    totalVA: reducedVA,
    amps: result.amps * (1 - savings),
    smartPanelApplied: true,
    savingsPercent: proposed.smartPanelSavingsPercent,
  };
}

// ─── Year-based assessment notes ──────────────────────────────────────────
export function yearAssessment(yearBuilt, panelRating) {
  const notes = [];
  if (yearBuilt < 1960) {
    notes.push('Pre-1960 homes typically had 60A fuse panels and may contain cloth-insulated or knob-and-tube wiring. Full rewire often required per WI SPS 316.');
    notes.push('Panel upgrade strongly recommended before adding significant new loads.');
  } else if (yearBuilt < 1970) {
    notes.push('1960s homes often have 100A service and may have aluminum branch circuits — inspect terminations (CO/ALR devices or pigtailing may be required).');
  } else if (yearBuilt < 1980) {
    notes.push('1970s panels may be Federal Pacific (FPE) Stab-Lok or Zinsco — known safety hazards. Replace before adding loads.');
  } else if (yearBuilt < 2000) {
    notes.push('1980s–1990s panels are typically 100–150A and may have limited spare breaker space. Verify capacity for added 240V circuits.');
  } else {
    notes.push('Post-2000 homes generally have 200A service and modern wiring — most retrofits fit without a panel upgrade.');
  }
  if (yearBuilt < 1990 && panelRating >= 200) {
    notes.push('Panel appears upgraded from the original service — verify with an electrician that the existing wiring supports the full 200A rating.');
  }
  return notes;
}

// ─── Main entry ───────────────────────────────────────────────────────────
export function calculateSideBySide({ panel, loads, proposed }) {
  const existingStandard = runStandard(panel, loads, proposed, 'existing');
  const existingOptional = runOptional(panel, loads, proposed, 'existing');
  const proposedStandard = runStandard(panel, loads, proposed, 'proposed');
  const proposedOptional = runOptional(panel, loads, proposed, 'proposed');

  // "Best" = whichever method yields the lower amperage. Optional method
  // requires ≥100A existing service per 220.82.
  const pickBest = (std, opt) => (opt.eligible && opt.amps < std.amps) ? opt : std;
  const existingBest = pickBest(existingStandard, existingOptional);
  const proposedBest = pickBest(proposedStandard, proposedOptional);

  const proposedSmart = smartPanelVariant(proposedBest, proposed);

  const codeNotes = [
    panel.panelRating < 100
      ? 'Optional Method (220.82) requires 100A or greater existing service — Standard Method applies to this panel.'
      : 'Both Standard and Optional methods are eligible; the lower result may be used per 220.82.',
    'Wisconsin SPS 316 adopts NEC with state amendments — always verify with local AHJ.',
    'Per SPS 322.45(3), heat pump supplemental heat must have lockout controls except during defrost.',
    'This tool is an estimation aid. Consult a licensed electrician for final load calculations and permit applications.',
  ];

  return {
    panel,
    existing: {
      standard: existingStandard,
      optional: existingOptional,
      best:     existingBest,
      status:   statusFor(existingBest.amps, panel.panelRating),
    },
    proposed: {
      standard: proposedStandard,
      optional: proposedOptional,
      best:     proposedBest,
      smart:    proposedSmart,
      status:   statusFor(proposedBest.amps, panel.panelRating),
      smartStatus: proposedSmart ? statusFor(proposedSmart.amps, panel.panelRating) : null,
    },
    recommendedPanelSize: recommendedPanelSize(proposedBest.amps),
    yearNotes: yearAssessment(panel.yearBuilt, panel.panelRating),
    codeNotes,
  };
}
