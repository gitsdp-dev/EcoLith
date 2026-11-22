import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiAnalysisSchema, normalizeGeminiOutput } from '../lib/gemini.js';
import { getRecoveryRecommendations, mapToDbRecoveryMethod } from '../../js/recovery.js';

test('INORGANIC: E-waste PCB scan normalized with condition, reusability score, and component harvesting', () => {
  const rawPcb = {
    food_name: 'Server Motherboard PCB with Dual LGA2011 Sockets',
    food_category: 'electronic_ewaste',
    waste_type: 'inorganic',
    condition: 'reusable_intact',
    condition_details:
      'Solder joints clean, no thermal blistering; high-value tantalum capacitors, power MOSFETs, and gold edge connectors intact.',
    reusability_score: 92,
    confidence: 0.95,
    estimated_quantity: 1,
    estimated_unit: 'piece',
    bounding_box: [120, 100, 880, 900],
    recovery_options: [
      {
        method: 'component_harvesting',
        reason:
          'Desolder functional microprocessors, voltage regulator modules, and crystal oscillators.',
        requirements: 'Use ESD-safe workstation and temperature-regulated hot air desoldering.',
        estimated_value: 'High ($25–$65 functional component salvage value)'
      },
      {
        method: 'precious_metal_recovery',
        reason:
          'Hydrometallurgical refining of gold contacts, silver solder, and copper inner layers.',
        requirements: 'Consolidate for certified ISO 14001 WEEE smelting refinery.',
        estimated_value: 'High ($4,000–$10,000/ton refined gold/copper yield)'
      }
    ],
    reuse_suggestions: [
      'Harvest high-current MOSFETs and heatsinks for custom robotics motor drivers',
      'Salvage copper heatpipes and fans for bench power supply cooling',
      'Repurpose board for educational electronics teardown and reverse engineering'
    ],
    hazard_alerts: [
      'Electrical charge hazard: Discharge bulk electrolytic filter capacitors before servicing',
      'Lead exposure: Wear nitrile gloves when handling lead-tin solder joints'
    ]
  };

  const normalized = normalizeGeminiOutput(rawPcb);
  const validated = geminiAnalysisSchema.safeParse(normalized);

  assert.equal(validated.success, true, 'PCB scan must pass Zod schema validation');
  assert.equal(normalized.items[0].waste_type, 'inorganic');
  assert.equal(normalized.items[0].food_category, 'electronic_ewaste');
  assert.equal(normalized.items[0].condition, 'reusable_intact');
  assert.equal(normalized.items[0].reusability_score, 92);
  assert.ok(normalized.items[0].condition_details.includes('tantalum capacitors'));
  assert.equal(normalized.items[0].recovery_options[0].method, 'component_harvesting');
  assert.equal(normalized.items[0].hazard_alerts.length, 2);
});

test('INORGANIC: Mechanical ball bearing scan detects refurbishable condition and realistic gram weight', () => {
  const rawBearing = {
    name: '6205-2RS Deep Groove Ball Bearing',
    condition: 'minor_wear_refurbishable',
    condition_details:
      'Cosmetic surface oxidation on outer race; inner balls and polyamide cage intact; zero perceptible radial play.',
    estimated_quantity: 1,
    estimated_unit: 'kg' // Unrealistic default
  };

  const normalized = normalizeGeminiOutput(rawBearing);
  const item = normalized.items[0];

  assert.equal(item.waste_type, 'inorganic', 'Bearing must be classified as inorganic');
  assert.equal(item.food_category, 'mechanical_hardware');
  assert.equal(item.condition, 'minor_wear_refurbishable');
  assert.ok(item.reusability_score >= 65 && item.reusability_score <= 85);
  assert.equal(item.estimated_unit, 'piece', 'Bearing unit should normalize to piece');
  assert.ok(item.recovery_options.length > 0);
});

test('INORGANIC: Industrial 6061 structural aluminum extrusion scan classifies metals and direct framing reuse', () => {
  const rawExtrusion = {
    food_name: '6061-T6 Structural Aluminum T-Slot Extrusion 4040',
    food_category: 'other', // Should self-heal to industrial_scrap_metal
    condition: 'reusable_intact',
    estimated_quantity: 2.5,
    estimated_unit: 'm'
  };

  const normalized = normalizeGeminiOutput(rawExtrusion);
  const item = normalized.items[0];

  assert.equal(item.waste_type, 'inorganic');
  assert.equal(
    item.food_category,
    'industrial_scrap_metal',
    'Aluminum extrusion must be classified as industrial metal'
  );
  assert.equal(item.estimated_unit, 'm', 'Linear profile measured in meters');
  assert.ok(
    item.recovery_options.some((r) => r.method === 'reuse' || r.method === 'scrap_recycling')
  );
});

test('INORGANIC: Engineering polymer HDPE drum regrind classifies polymers and pelletizing pathway', () => {
  const rawPolymer = {
    food_name: 'High-Density Polyethylene HDPE Industrial Blue Drum Scrap',
    condition: 'scrap_recyclable'
  };

  const normalized = normalizeGeminiOutput(rawPolymer);
  const item = normalized.items[0];

  assert.equal(item.waste_type, 'inorganic');
  assert.equal(item.food_category, 'engineering_polymer');
  assert.equal(item.condition, 'scrap_recyclable');
  assert.ok(item.reusability_score <= 40, 'Scrap condition should yield low reusability score');
});

test('INORGANIC: Battery storage classifies as hazardous stream and separate disposal', () => {
  const rawBattery = {
    food_name: '18650 Li-ion Battery Cells Pack',
    condition: 'hazardous_damaged',
    condition_details:
      'Thermal swelling observed on outer nickel wrapper; potential internal short circuit risk.'
  };

  const normalized = normalizeGeminiOutput(rawBattery);
  const item = normalized.items[0];

  assert.equal(item.waste_type, 'inorganic');
  assert.equal(item.food_category, 'battery_storage');
  assert.equal(item.waste_category, 'other_separate', 'Hazardous battery must be other_separate');
  assert.equal(item.condition, 'hazardous_damaged');
  assert.ok(item.hazard_alerts.length > 0, 'Hazardous battery must provide hazard warnings');
});

test('DATABASE COMPATIBILITY: mapToDbRecoveryMethod converts advanced methods to core DB enums', () => {
  const expectedMappings = {
    component_harvesting: 'material_recovery',
    precious_metal_recovery: 'material_recovery',
    scrap_recycling: 'material_recovery',
    chemical_recycling: 'material_recovery',
    refurbishment: 'reuse',
    remanufacturing: 'reuse',
    hazardous_neutralization: 'separate_disposal',
    reuse: 'reuse',
    composting: 'composting',
    biogas: 'biogas',
    pectin_recovery: 'pectin_recovery',
    material_recovery: 'material_recovery',
    separate_disposal: 'separate_disposal',
    redistribution: 'redistribution'
  };

  const validDbSet = new Set([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ]);

  for (const [advancedMethod, expectedDbMethod] of Object.entries(expectedMappings)) {
    const mapped = mapToDbRecoveryMethod(advancedMethod);
    assert.equal(
      mapped,
      expectedDbMethod,
      `Method ${advancedMethod} should map to ${expectedDbMethod}`
    );
    assert.ok(validDbSet.has(mapped), `${mapped} must be one of the 7 valid core database enums`);
  }
});

test('RECOVERY ENGINE: Matches inorganic industrial materials correctly across rules and inference', async () => {
  // 1. Electronic Circuit Board
  const pcbRecs = await getRecoveryRecommendations(
    'Computer motherboard PCB',
    'unavoidable_organic',
    'electronic_ewaste'
  );
  assert.ok(pcbRecs.length > 0);
  assert.ok(
    pcbRecs.some((r) => r.method === 'material_recovery' || r.method === 'component_harvesting')
  );

  // 2. High-strength bolts
  const boltRecs = await getRecoveryRecommendations(
    'High tensile grade 10.9 hex bolts',
    'edible_reusable',
    'mechanical_hardware'
  );
  assert.ok(boltRecs.length > 0);
  assert.ok(boltRecs.some((r) => r.method === 'reuse'));

  // 3. Copper wiring
  const copperRecs = await getRecoveryRecommendations(
    'Bare bright copper electrical wire',
    'unavoidable_organic',
    'industrial_scrap_metal'
  );
  assert.ok(copperRecs.length > 0);
  assert.ok(copperRecs.some((r) => r.method === 'material_recovery'));

  // 4. Lithium Battery
  const batteryRecs = await getRecoveryRecommendations(
    'Lithium ion 18650 cell',
    'other_separate',
    'battery_storage'
  );
  assert.ok(batteryRecs.length > 0);
  assert.ok(
    batteryRecs.some(
      (r) => r.method === 'separate_disposal' || r.method === 'hazardous_neutralization'
    )
  );
});
