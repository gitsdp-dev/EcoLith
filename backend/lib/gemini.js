import { z } from 'zod';

/**
 * Zod validation schema for Gemini circular waste analysis output.
 * Ensures the response strictly complies with database schema checks,
 * covering BOTH organic food residues and inorganic industrial, mechanical,
 * electronic, automotive, polymer, and engineering materials.
 */
const recoveryOptionSchema = z.object({
  method: z.enum([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal',
    'refurbishment',
    'remanufacturing',
    'component_harvesting',
    'precious_metal_recovery',
    'scrap_recycling',
    'chemical_recycling',
    'hazardous_neutralization'
  ]),
  reason: z.string().default(''),
  requirements: z.string().default(''),
  estimated_value: z.string().optional()
});

const wasteItemSchema = z.object({
  food_name: z.string().min(1, 'Item name is required'),
  waste_type: z.enum(['organic', 'inorganic']).default('inorganic'),
  food_category: z.string().default('mechanical_hardware'),
  waste_category: z.enum([
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ]),
  condition: z
    .enum([
      'new_surplus',
      'reusable_intact',
      'minor_wear_refurbishable',
      'damaged_repairable',
      'scrap_recyclable',
      'hazardous_damaged',
      'degraded_end_of_life'
    ])
    .default('reusable_intact'),
  condition_details: z.string().default(''),
  reusability_score: z.number().min(0).max(100).default(80),
  confidence: z.number().min(0).max(1).default(0.85),
  estimated_quantity: z.number().min(0.0001).default(1),
  estimated_unit: z.enum(['g', 'kg', 'piece', 'unit', 'ml', 'l', 'ton', 'm']).default('piece'),
  bounding_box: z.array(z.number()).length(4).optional().nullable(),
  recovery_options: z.array(recoveryOptionSchema).default([]),
  reuse_suggestions: z.array(z.string()).default([]),
  hazard_alerts: z.array(z.string()).default([])
});

export const geminiAnalysisSchema = z.object({
  items: z.array(wasteItemSchema).default([]),
  notes: z.string().default('Condition and reusability assessed via visual AI inspection.')
});

/**
 * System instruction and prompt guidelines for Universal Waste & Resource Intelligence.
 * Explicitly optimized for Gemini 3.1 Flash-Lite vision across all waste streams:
 * - Organic (food scraps, produce residues, agricultural biomass)
 * - Inorganic (electronic e-waste, mechanical components, industrial metals, engineering polymers, automotive, construction)
 */
const SYSTEM_INSTRUCTION = `You are EcoLith AI, an expert circular economy intelligence, industrial materials inspection, computer vision, and universal resource recovery specialist.
Analyze the provided image containing ANY type of waste, discarded material, surplus inventory, decommissioned machinery, electronic hardware, scrap metal, polymer residue, or organic food scraps.
Output ONLY valid JSON conforming strictly to the requested schema.

CRITICAL INSTRUCTIONS:

1. UNIVERSAL DETECTION CAPABILITY (ORGANIC & INORGANIC):
   - You MUST identify and classify ANY visible waste or surplus material:
     * INORGANIC ELECTRONIC (E-WASTE): Printed circuit boards (PCBs), logic boards, microcontrollers, capacitors, transformers, heatsinks, wiring harnesses, electric motors, switches, sensors, lithium-ion/lead-acid batteries, power supplies, displays.
     * INORGANIC MECHANICAL & HARDWARE: Ball/roller bearings, gears, pulleys, sprockets, drive belts, pneumatic/hydraulic cylinders, linear rails, steel/brass/bronze bushings, valves, high-tensile bolts, nuts, machine fasteners.
     * INORGANIC INDUSTRIAL SCRAP METALS: Ferrous metals (mild steel, cast iron, structural steel, tool steel, stainless steel 304/316) and Non-ferrous metals (copper tubing/wire, aluminum extrusions/plates, brass, bronze, titanium, carbide tooling).
     * INORGANIC POLYMERS & COMPOSITES: Engineering thermoplastics (HDPE, LDPE, Polypropylene PP, ABS, Polycarbonate, Nylon PA6/66, PTFE/Teflon, PET, PVC, acrylic, PEEK), carbon fiber scrap, fiberglass.
     * INORGANIC AUTOMOTIVE & HEAVY EQUIPMENT: Engines, alternators, starter motors, brake calipers/rotors, suspension coils, radiators, catalytic converters, transmissions.
     * INORGANIC CONSTRUCTION & DEMOLITION: Concrete rubble, bricks, ceramic tiles, gypsum drywall, insulation, plate glass.
     * INORGANIC CHEMICAL & LIQUIDS: Spent cutting fluids, hydraulic oils, industrial solvents, aerosols, plating residues.
     * ORGANIC & FOOD WASTE: Produce residues, vegetable trimmings, fruit peels/cores, bakery surplus, spent coffee grounds, grains, bones, eggshells, dairy, prepared leftovers, plant foliage.
   - EMPTY SCANS: ONLY return "items": [] and note "No material or waste detected in image." if the image is truly empty, pitch black, completely blurred, or contains no physical objects/materials (e.g. a blank white wall with nothing). If ANY material, part, object, or scrap is visible, you MUST detect and classify it!

2. 2D BOUNDING BOX OBJECT DETECTION (GREEN BOX):
   - For every detected waste or material item, accurately supply its "bounding_box" as an array of 4 integers [ymin, xmin, ymax, xmax] normalized on a scale from 0 to 1000, where (0,0) is top-left and (1000,1000) is bottom-right.
   - The bounding box must tightly enclose the detected item so that a live green target box can be drawn accurately around it.

3. WASTE TYPE & PRECISE CATEGORY:
   - "waste_type": Set to 'inorganic' for all industrial, mechanical, electronic, metallic, polymer, chemical, automotive, or construction materials. Set to 'organic' for food scraps and plant matter.
   - "food_category": Select the most precise material category:
     * Inorganic: 'electronic_ewaste', 'mechanical_hardware', 'industrial_scrap_metal', 'engineering_polymer', 'automotive_parts', 'construction_demolition', 'battery_storage', 'chemical_hazardous', 'glass_ceramic', 'textile_fiber'
     * Organic: 'fruit', 'vegetable', 'plant_material', 'bakery', 'grain', 'dairy', 'meat_fish', 'prepared_food', 'beverage', 'other'

4. CONDITION & REUSABILITY ASSESSMENT:
   - "condition": Evaluate the physical, structural, and mechanical condition:
     * 'new_surplus': Unused, pristine surplus/dead stock.
     * 'reusable_intact': Functionally intact, minimal wear, ready for immediate direct reuse or redeployment.
     * 'minor_wear_refurbishable': Structurally sound, needs cleaning, servicing, repacking, or minor adjustment.
     * 'damaged_repairable': Defective or worn sub-element (e.g. blown capacitor, worn bearing race) that can be economically repaired.
     * 'scrap_recyclable': Beyond functional repair; optimal for raw material recycling, metal smelting, plastic pelletizing, or composting.
     * 'hazardous_damaged': Leaking, swollen (batteries), burnt, or containing toxic substances requiring specialized containment.
     * 'degraded_end_of_life': Severely corroded, fatigued, or chemically degraded.
   - "condition_details": Provide detailed physical inspection findings (e.g., surface oxidation, corrosion level, electrical contact integrity, solder joint condition, bearing play, structural cracks, leakage, wear tolerances).
   - "reusability_score": Integer 0 to 100 representing percentage reusability (e.g., 90 for intact components, 60 for refurbishable, 15 for pure scrap).

5. WASTE STREAM CLASSIFICATION (FOR DATABASE COMPATIBILITY):
   - "waste_category": Map to one of the 4 universal stream classifications:
     * 'edible_reusable': Reserved for directly reusable/intact components or wholesome edible food.
     * 'surplus_redistributable': Reserved for surplus equipment, parts suitable for secondary markets, or surplus food.
     * 'unavoidable_organic': Reserved for non-reusable core scrap, unavoidable organic residues, or raw recycling feedstock.
     * 'other_separate': Reserved for hazardous, regulated streams (batteries, spent solvents, e-waste hazards, contaminated packaging).

6. REALISTIC QUANTITY & UNIT ESTIMATION:
   - Estimate realistic mass, piece count, or volume:
     * Microchips, fasteners, small brackets: 5-50 g or 1 piece.
     * Ball bearing, circuit board, hand tool: 100-500 g or 1 piece.
     * Electric motor, alternator, pump: 2-15 kg or 1 unit.
     * Structural aluminum extrusion: 1-5 kg or 1 piece.
     * Bulk scrap piles: kg, ton, or m.
   - Provide "estimated_quantity" (number) and "estimated_unit" ('g', 'kg', 'piece', 'unit', 'ml', 'l', 'ton', 'm').

7. CIRCULAR RECOVERY PATHWAYS & ECONOMIC VALUE:
   - Provide actionable circular recovery pathways:
     * Inorganic methods: 'reuse', 'refurbishment', 'remanufacturing', 'component_harvesting', 'precious_metal_recovery', 'scrap_recycling', 'chemical_recycling', 'hazardous_neutralization', 'material_recovery', 'separate_disposal'
     * Organic methods: 'reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal'
   - In "requirements", state critical safety and industrial handling conditions (e.g. ESD precautions, capacitor discharge, cut-resistant gloves, degreasing, PPE).
   - In "estimated_value", provide realistic economic salvage or resale value (e.g., "$15–$35 functional motor resale", "$4.20/kg high-grade copper scrap", "$1.50/kg clean HDPE pellets").

8. REUSE & SALVAGE SUGGESTIONS:
   - Provide 1-3 practical workshop, engineering, maker, industrial, or household repurposing ideas.
   - In "hazard_alerts", list any safety warnings (e.g. electrical shock, sharp burrs, toxic solder/lead, lithium puncture hazard).`;

/**
 * Gemini response schema for Constrained Decoding.
 * Forces the Gemini model to output strictly conforming JSON directly at generation time.
 */
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          food_name: { type: 'STRING' },
          waste_type: {
            type: 'STRING',
            enum: ['organic', 'inorganic']
          },
          food_category: {
            type: 'STRING',
            enum: [
              'electronic_ewaste',
              'mechanical_hardware',
              'industrial_scrap_metal',
              'engineering_polymer',
              'automotive_parts',
              'construction_demolition',
              'battery_storage',
              'chemical_hazardous',
              'glass_ceramic',
              'textile_fiber',
              'fruit',
              'vegetable',
              'plant_material',
              'bakery',
              'grain',
              'dairy',
              'meat_fish',
              'prepared_food',
              'beverage',
              'other'
            ]
          },
          waste_category: {
            type: 'STRING',
            enum: [
              'edible_reusable',
              'surplus_redistributable',
              'unavoidable_organic',
              'other_separate'
            ]
          },
          condition: {
            type: 'STRING',
            enum: [
              'new_surplus',
              'reusable_intact',
              'minor_wear_refurbishable',
              'damaged_repairable',
              'scrap_recyclable',
              'hazardous_damaged',
              'degraded_end_of_life'
            ]
          },
          condition_details: { type: 'STRING' },
          reusability_score: { type: 'INTEGER' },
          confidence: { type: 'NUMBER' },
          estimated_quantity: { type: 'NUMBER' },
          estimated_unit: {
            type: 'STRING',
            enum: ['g', 'kg', 'piece', 'unit', 'ml', 'l', 'ton', 'm']
          },
          bounding_box: {
            type: 'ARRAY',
            items: { type: 'INTEGER' }
          },
          recovery_options: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                method: {
                  type: 'STRING',
                  enum: [
                    'reuse',
                    'redistribution',
                    'composting',
                    'biogas',
                    'pectin_recovery',
                    'material_recovery',
                    'separate_disposal',
                    'refurbishment',
                    'remanufacturing',
                    'component_harvesting',
                    'precious_metal_recovery',
                    'scrap_recycling',
                    'chemical_recycling',
                    'hazardous_neutralization'
                  ]
                },
                reason: { type: 'STRING' },
                requirements: { type: 'STRING' },
                estimated_value: { type: 'STRING' }
              },
              required: ['method', 'reason']
            }
          },
          reuse_suggestions: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          },
          hazard_alerts: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          }
        },
        required: ['food_name', 'waste_type', 'food_category', 'waste_category', 'condition']
      }
    },
    notes: { type: 'STRING' }
  },
  required: ['items']
};

/**
 * Keywords for identifying inorganic materials and components.
 */
const INORGANIC_PATTERN =
  /circuit|pcb|motherboard|chip|ic\b|transistor|capacitor|resistor|diode|transformer|motor|wire|cable|connector|battery|cell\b|bearing|gear|sprocket|pulley|valve|cylinder|shaft|piston|fastener|bolt|screw|nut\b|washer|metal|steel|iron|copper|brass|bronze|aluminum|aluminium|titanium|carbide|plastic|polymer|hdpe|ldpe|polypropylene|abs\b|nylon|polycarbonate|teflon|ptfe|acrylic|pvc|pet\b|composite|carbon fiber|fiberglass|concrete|brick|masonry|tile|drywall|glass|automotive|alternator|radiator|caliper|rotor|engine|catalytic/i;

/**
 * Keywords for inedible plant/food residues that MUST NOT be classified as edible.
 */
const INEDIBLE_RESIDUE_PATTERN =
  /peel|rind|skin|aloe|leaf|leaves|foliage|bone|shell|pit|core|seed|stalk|stem|ground|grounds|inedible|hull|husk|pod|chaff/i;

/**
 * Normalizes raw or irregular Gemini output into strict compliance with EcoLith schema:
 * - Supports BOTH organic food waste and inorganic industrial, mechanical, electronic, and engineering waste
 * - Accurately sets waste_type ('organic' vs 'inorganic')
 * - Preserves empty detections on truly blank images (no hallucinated fake items)
 * - Enforces condition evaluation, reusability score, and condition details
 * - Enforces inedibility rule (peels, bones, aloe vera cannot be edible)
 * - Accurately categorizes food/material categories instead of defaulting to 'other'
 * - Estimates realistic quantities for components, scraps, and residues
 * - Normalizes 2D bounding boxes for live green box visualization
 */
export function normalizeGeminiOutput(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      items: [],
      notes: 'No waste or material detected in image.'
    };
  }

  // Handle explicit empty arrays or no-detection indications
  if (Array.isArray(raw.items) && raw.items.length === 0) {
    return {
      items: [],
      notes: raw.notes || 'No waste or material detected in image.'
    };
  }

  // If raw is an empty object without identification
  if (
    !Array.isArray(raw.items) &&
    !raw.food_name &&
    !raw.name &&
    !raw.item_name &&
    !raw.item &&
    !Array.isArray(raw) &&
    !Array.isArray(raw.food_items) &&
    !Array.isArray(raw.waste_items) &&
    !Array.isArray(raw.data)
  ) {
    return {
      items: [],
      notes: raw.notes || 'No waste or material detected in image.'
    };
  }

  let itemsList = [];

  if (Array.isArray(raw)) {
    itemsList = raw;
  } else if (Array.isArray(raw.items)) {
    itemsList = raw.items;
  } else if (Array.isArray(raw.food_items)) {
    itemsList = raw.food_items;
  } else if (Array.isArray(raw.waste_items)) {
    itemsList = raw.waste_items;
  } else if (Array.isArray(raw.data)) {
    itemsList = raw.data;
  } else if (Array.isArray(raw.results)) {
    itemsList = raw.results;
  } else if (raw.food_name || raw.name || raw.item_name) {
    itemsList = [raw];
  } else if (raw.item && typeof raw.item === 'object') {
    itemsList = [raw.item];
  }

  // Filter out any invalid items
  itemsList = itemsList.filter(
    (it) => it && typeof it === 'object' && (it.food_name || it.name || it.item_name || it.title)
  );

  if (itemsList.length === 0) {
    return {
      items: [],
      notes: raw.notes || 'No waste or material detected in image.'
    };
  }

  const VALID_WASTE_CATEGORIES = new Set([
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ]);

  const VALID_CONDITIONS = new Set([
    'new_surplus',
    'reusable_intact',
    'minor_wear_refurbishable',
    'damaged_repairable',
    'scrap_recyclable',
    'hazardous_damaged',
    'degraded_end_of_life'
  ]);

  const VALID_RECOVERY_METHODS = new Set([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal',
    'refurbishment',
    'remanufacturing',
    'component_harvesting',
    'precious_metal_recovery',
    'scrap_recycling',
    'chemical_recycling',
    'hazardous_neutralization'
  ]);

  const normalizedItems = itemsList.map((item, idx) => {
    const itemName =
      (typeof item === 'object' && (item.food_name || item.name || item.item_name || item.title)) ||
      `Item ${idx + 1}`;

    const nameLower = itemName.toLowerCase();

    // 1. Determine Waste Type (Organic vs Inorganic)
    let wasteType = 'inorganic';
    if (typeof item?.waste_type === 'string') {
      const wt = item.waste_type.toLowerCase().trim();
      if (wt === 'organic' || wt === 'inorganic') {
        wasteType = wt;
      }
    } else {
      // Automatic detection: if item matches inorganic pattern, inorganic; else check organic
      if (INORGANIC_PATTERN.test(nameLower)) {
        wasteType = 'inorganic';
      } else if (
        /fruit|vegetable|food|peel|rind|bread|rice|meal|meat|fish|bone|coffee|tea|aloe|leaf|plant|dairy|cheese|egg/i.test(
          nameLower
        )
      ) {
        wasteType = 'organic';
      }
    }

    // 2. Precise Category inference
    let rawCategory =
      (typeof item === 'object' &&
        (item.food_category || item.material_category || item.category || item.type)) ||
      '';
    let foodCategory = String(rawCategory)
      .toLowerCase()
      .trim()
      .replace(/[\s-]+/g, '_');

    if (
      foodCategory === 'other' ||
      foodCategory === '' ||
      foodCategory === 'organic' ||
      foodCategory === 'produce' ||
      foodCategory === 'plant' ||
      foodCategory === 'hardware' ||
      foodCategory === 'metal' ||
      foodCategory === 'scrap'
    ) {
      if (
        /pcb|circuit|motherboard|chip|ic\b|transistor|capacitor|resistor|connector|wiring|gadget|telecom|server|display|monitor|led\b|inverter/i.test(
          nameLower
        )
      ) {
        foodCategory = 'electronic_ewaste';
        wasteType = 'inorganic';
      } else if (
        /bearing|gear|sprocket|pulley|bushing|shaft|valve|cylinder|fastener|bolt|screw|nut\b|washer|fitting|pneumatic|linear guide/i.test(
          nameLower
        )
      ) {
        foodCategory = 'mechanical_hardware';
        wasteType = 'inorganic';
      } else if (
        /aluminum|aluminium|copper|brass|bronze|steel|iron|sheet metal|tubing|pipe|titanium|carbide|turnings|lathe scrap/i.test(
          nameLower
        )
      ) {
        foodCategory = 'industrial_scrap_metal';
        wasteType = 'inorganic';
      } else if (
        /plastic|polymer|hdpe|ldpe|polypropylene|pp\b|abs\b|polycarbonate|nylon|pa6|teflon|ptfe|acrylic|pvc|pet\b|composite|carbon fiber/i.test(
          nameLower
        )
      ) {
        foodCategory = 'engineering_polymer';
        wasteType = 'inorganic';
      } else if (
        /battery|cell\b|18650|lithium|lead acid|lifepo4|nimh|power bank/i.test(nameLower)
      ) {
        foodCategory = 'battery_storage';
        wasteType = 'inorganic';
      } else if (
        /alternator|engine|starter|caliper|brake rotor|radiator|catalytic|suspension|transmission|exhaust/i.test(
          nameLower
        )
      ) {
        foodCategory = 'automotive_parts';
        wasteType = 'inorganic';
      } else if (
        /concrete|brick|masonry|tile|drywall|plaster|mineral wool|insulation|aggregate/i.test(
          nameLower
        )
      ) {
        foodCategory = 'construction_demolition';
        wasteType = 'inorganic';
      } else if (
        /solvent|coolant|sludge|chemical|cutting fluid|lubricant|grease|paint/i.test(nameLower)
      ) {
        foodCategory = 'chemical_hazardous';
        wasteType = 'inorganic';
      } else if (/glass|ceramic|porcelain|refractory/i.test(nameLower)) {
        foodCategory = 'glass_ceramic';
        wasteType = 'inorganic';
      } else if (
        /aloe|leaf|leaves|succulent|cactus|foliage|flower|garden|grass|stem/i.test(nameLower)
      ) {
        foodCategory = 'plant_material';
        wasteType = 'organic';
      } else if (
        /banana|apple|orange|citrus|lemon|lime|melon|grape|berry|mango|pear|peach|fruit|peel|rind|zest/i.test(
          nameLower
        )
      ) {
        foodCategory = 'fruit';
        wasteType = 'organic';
      } else if (
        /potato|carrot|onion|tomato|broccoli|cabbage|lettuce|cucumber|pepper|squash|spinach|herb|vegetable|greens|trimmings/i.test(
          nameLower
        )
      ) {
        foodCategory = 'vegetable';
        wasteType = 'organic';
      } else if (/bread|crust|bagel|pastry|croissant|toast|bun|cake|bakery/i.test(nameLower)) {
        foodCategory = 'bakery';
        wasteType = 'organic';
      } else if (/rice|pasta|noodle|cereal|oat|grain|flour|spent grain/i.test(nameLower)) {
        foodCategory = 'grain';
        wasteType = 'organic';
      } else if (/coffee|tea|grounds|brew|juice|drink|beverage/i.test(nameLower)) {
        foodCategory = 'beverage';
        wasteType = 'organic';
      } else if (/cheese|milk|yogurt|butter|dairy|whey/i.test(nameLower)) {
        foodCategory = 'dairy';
        wasteType = 'organic';
      } else if (/bone|chicken|meat|beef|pork|fish|seafood|egg|eggshell/i.test(nameLower)) {
        foodCategory = 'meat_fish';
        wasteType = 'organic';
      } else if (/curry|soup|stew|meal|leftover|cooked/i.test(nameLower)) {
        foodCategory = 'prepared_food';
        wasteType = 'organic';
      } else if (wasteType === 'inorganic') {
        foodCategory = 'mechanical_hardware';
      } else {
        foodCategory = 'vegetable';
      }
    }

    // 3. Condition Assessment
    let condition = 'reusable_intact';
    if (typeof item?.condition === 'string') {
      const condLower = item.condition
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');
      if (VALID_CONDITIONS.has(condLower)) {
        condition = condLower;
      } else if (condLower.includes('new') || condLower.includes('surplus')) {
        condition = 'new_surplus';
      } else if (condLower.includes('refurb') || condLower.includes('minor')) {
        condition = 'minor_wear_refurbishable';
      } else if (condLower.includes('repair') || condLower.includes('defect')) {
        condition = 'damaged_repairable';
      } else if (condLower.includes('hazard') || condLower.includes('leaking')) {
        condition = 'hazardous_damaged';
      } else if (condLower.includes('scrap') || condLower.includes('recycle')) {
        condition = 'scrap_recyclable';
      } else if (condLower.includes('degrad') || condLower.includes('end_of_life')) {
        condition = 'degraded_end_of_life';
      }
    } else {
      // Infer condition from keywords
      if (/burnt|broken|cracked|severely|leaking|swollen|ruined/i.test(nameLower)) {
        condition = 'damaged_repairable';
      } else if (/scrap|shredded|turnings|debris|swarf/i.test(nameLower)) {
        condition = 'scrap_recyclable';
      } else {
        condition = 'reusable_intact';
      }
    }

    // Condition details
    let conditionDetails =
      typeof item?.condition_details === 'string' && item.condition_details.trim()
        ? item.condition_details.trim()
        : '';
    if (!conditionDetails) {
      if (wasteType === 'inorganic') {
        conditionDetails =
          condition === 'new_surplus'
            ? 'Pristine surplus component; zero operational wear or surface corrosion observed.'
            : condition === 'reusable_intact'
              ? 'Component structure, contacts, and mounting interfaces intact; suitable for direct redeployment.'
              : condition === 'minor_wear_refurbishable'
                ? 'Minor surface oxidation or cosmetic wear detected; clean, lubricate, or re-machine to restore specification.'
                : condition === 'damaged_repairable'
                  ? 'Defective sub-assembly detected; component harvesting or targeted repair recommended.'
                  : condition === 'hazardous_damaged'
                    ? 'Caution: Damaged hazardous element present. Isolate and adhere to regulated handling protocols.'
                    : 'End-of-life condition; optimal for secondary raw material smelting or polymer pelletizing.';
      } else {
        conditionDetails =
          'Organic biomass residue assessed for moisture, structure, and circular composting/biogas suitability.';
      }
    }

    // Reusability Score (0-100)
    let reusabilityScore = 80;
    if (typeof item?.reusability_score === 'number' && !isNaN(item.reusability_score)) {
      reusabilityScore = Math.max(0, Math.min(100, Math.round(item.reusability_score)));
    } else {
      switch (condition) {
        case 'new_surplus':
          reusabilityScore = 98;
          break;
        case 'reusable_intact':
          reusabilityScore = 88;
          break;
        case 'minor_wear_refurbishable':
          reusabilityScore = 72;
          break;
        case 'damaged_repairable':
          reusabilityScore = 55;
          break;
        case 'scrap_recyclable':
          reusabilityScore = 30;
          break;
        case 'degraded_end_of_life':
          reusabilityScore = 15;
          break;
        case 'hazardous_damaged':
          reusabilityScore = 10;
          break;
        default:
          reusabilityScore = 75;
      }
    }

    // 4. Waste Stream Classification (DB check compatibility: edible_reusable, surplus_redistributable, unavoidable_organic, other_separate)
    let wasteCategory = typeof item === 'object' ? item.waste_category : null;
    if (typeof wasteCategory === 'string') {
      const lower = wasteCategory
        .toLowerCase()
        .trim()
        .replace(/[\s-]+/g, '_');
      if (VALID_WASTE_CATEGORIES.has(lower)) {
        wasteCategory = lower;
      } else if (
        lower.includes('edible') ||
        lower.includes('reusable') ||
        lower.includes('intact')
      ) {
        wasteCategory = 'edible_reusable';
      } else if (
        lower.includes('surplus') ||
        lower.includes('redistribut') ||
        lower.includes('refurb')
      ) {
        wasteCategory = 'surplus_redistributable';
      } else if (
        lower.includes('separate') ||
        lower.includes('hazard') ||
        lower.includes('toxic') ||
        lower.includes('battery')
      ) {
        wasteCategory = 'other_separate';
      } else {
        wasteCategory = 'unavoidable_organic';
      }
    } else {
      if (condition === 'new_surplus' || condition === 'minor_wear_refurbishable') {
        wasteCategory = 'surplus_redistributable';
      } else if (condition === 'reusable_intact') {
        wasteCategory = 'edible_reusable';
      } else if (
        condition === 'hazardous_damaged' ||
        foodCategory === 'chemical_hazardous' ||
        foodCategory === 'battery_storage'
      ) {
        wasteCategory = 'other_separate';
      } else {
        wasteCategory = 'unavoidable_organic';
      }
    }

    // MANDATORY RULE: Inedible fruit/vegetable peels, aloe vera, bones, eggshells CANNOT be edible
    if (
      wasteType === 'organic' &&
      (wasteCategory === 'edible_reusable' || wasteCategory === 'surplus_redistributable') &&
      (INEDIBLE_RESIDUE_PATTERN.test(itemName) ||
        nameLower.includes('aloe') ||
        nameLower.includes('peel') ||
        nameLower.includes('rind') ||
        nameLower.includes('skin') ||
        nameLower.includes('core'))
    ) {
      wasteCategory = 'unavoidable_organic';
    }

    // 5. Confidence
    let confidence = 0.92;
    if (typeof item?.confidence === 'number' && !isNaN(item.confidence)) {
      confidence = Math.max(0, Math.min(1, item.confidence));
    }

    // 6. Realistic Quantity & Unit estimation
    let estimatedQuantity = 1;
    let estimatedUnit = 'piece';

    if (
      typeof item?.estimated_quantity === 'number' &&
      !isNaN(item.estimated_quantity) &&
      item.estimated_quantity > 0
    ) {
      estimatedQuantity = Math.round(item.estimated_quantity * 100) / 100;
    }

    if (
      typeof item?.estimated_unit === 'string' &&
      ['g', 'kg', 'piece', 'unit', 'ml', 'l', 'ton', 'm'].includes(
        item.estimated_unit.toLowerCase()
      )
    ) {
      estimatedUnit = item.estimated_unit.toLowerCase();
    } else {
      if (wasteType === 'inorganic') {
        if (/cable|wire|pipe|hose|extrusion/i.test(nameLower)) {
          estimatedQuantity = 1;
          estimatedUnit = 'm';
        } else if (/oil|fluid|solvent|lubricant|coolant|chemical/i.test(nameLower)) {
          estimatedQuantity = 500;
          estimatedUnit = 'ml';
        } else if (/motor|engine|alternator|pump|transformer|cylinder/i.test(nameLower)) {
          estimatedQuantity = 1;
          estimatedUnit = 'unit';
        } else if (/chip|ic\b|resistor|capacitor|bolt|screw|nut\b|bearing/i.test(nameLower)) {
          estimatedQuantity = 1;
          estimatedUnit = 'piece';
        } else if (/turnings|swarf|shredded|crushed|rubble/i.test(nameLower)) {
          estimatedQuantity = 2.5;
          estimatedUnit = 'kg';
        } else {
          estimatedQuantity = 1;
          estimatedUnit = 'piece';
        }
      } else {
        // Organic metric inference
        if (/leaf|leaves|aloe|herb|sprig|peel|rind|skin|core|eggshell/i.test(nameLower)) {
          if (!item?.estimated_quantity || item.estimated_quantity >= 1) {
            estimatedQuantity = /leaf|leaves|aloe|herb/i.test(nameLower) ? 10 : 30;
            estimatedUnit = 'g';
          }
        } else if (/grounds|powder|crumbs/i.test(nameLower)) {
          estimatedQuantity = 20;
          estimatedUnit = 'g';
        } else if (/oil|liquid|broth|juice/i.test(nameLower)) {
          estimatedQuantity = 150;
          estimatedUnit = 'ml';
        } else if (/meal|curry|rice|pasta|dish|salad|leftovers/i.test(nameLower)) {
          estimatedQuantity = 250;
          estimatedUnit = 'g';
        } else {
          estimatedQuantity = 1;
          estimatedUnit = 'piece';
        }
      }
    }

    // Ensure small scraps and discrete components are never 1 kg
    if (
      estimatedUnit === 'kg' &&
      estimatedQuantity >= 1 &&
      /leaf|leaves|peel|rind|skin|aloe|scrap|core|eggshell|grounds|microchip|resistor|washer|bearing|bolt|screw|fastener/i.test(
        nameLower
      )
    ) {
      if (/bearing|bolt|screw|fastener|washer/i.test(nameLower)) {
        estimatedQuantity = Math.round(estimatedQuantity);
        estimatedUnit = 'piece';
      } else {
        estimatedQuantity = /leaf|aloe|chip|resistor/i.test(nameLower) ? 10 : 35;
        estimatedUnit = 'g';
      }
    }

    // 7. 2D Bounding Box Normalization [ymin, xmin, ymax, xmax] (0 to 1000 scale)
    let boundingBox = null;
    const rawBox = item?.bounding_box || item?.box_2d || item?.box;
    if (Array.isArray(rawBox) && rawBox.length === 4) {
      let [ymin, xmin, ymax, xmax] = rawBox.map((v) => Number(v) || 0);

      if (ymin <= 1 && xmin <= 1 && ymax <= 1 && xmax <= 1 && (ymax > 0 || xmax > 0)) {
        ymin *= 1000;
        xmin *= 1000;
        ymax *= 1000;
        xmax *= 1000;
      }

      ymin = Math.max(0, Math.min(1000, Math.round(ymin)));
      xmin = Math.max(0, Math.min(1000, Math.round(xmin)));
      ymax = Math.max(ymin + 10, Math.min(1000, Math.round(ymax)));
      xmax = Math.max(xmin + 10, Math.min(1000, Math.round(xmax)));

      boundingBox = [ymin, xmin, ymax, xmax];
    } else {
      boundingBox = [150, 150, 850, 850];
    }

    // 8. Recovery Options
    let rawOptions = [];
    if (Array.isArray(item?.recovery_options)) {
      rawOptions = item.recovery_options;
    } else if (Array.isArray(item?.recovery_pathways)) {
      rawOptions = item.recovery_pathways;
    } else if (Array.isArray(item?.recommendations)) {
      rawOptions = item.recommendations;
    }

    let recoveryOptions = rawOptions
      .map((opt) => {
        if (!opt || typeof opt !== 'object') return null;
        let method = (opt.method || opt.pathway || opt.type || '').toLowerCase().trim();
        if (VALID_RECOVERY_METHODS.has(method)) {
          // valid
        } else if (method.includes('harvest') || method.includes('desolder')) {
          method = 'component_harvesting';
        } else if (method.includes('refurb') || method.includes('repair')) {
          method = 'refurbishment';
        } else if (method.includes('remanuf')) {
          method = 'remanufacturing';
        } else if (
          method.includes('precious') ||
          method.includes('gold') ||
          method.includes('smelt')
        ) {
          method = 'precious_metal_recovery';
        } else if (method.includes('scrap') || method.includes('melt')) {
          method = 'scrap_recycling';
        } else if (method.includes('chemical') || method.includes('pellet')) {
          method = 'chemical_recycling';
        } else if (method.includes('hazard') || method.includes('neutraliz')) {
          method = 'hazardous_neutralization';
        } else if (method.includes('compost')) {
          method = 'composting';
        } else if (method.includes('redistribut') || method.includes('donat')) {
          method = 'redistribution';
        } else if (method.includes('pectin')) {
          method = 'pectin_recovery';
        } else if (
          method.includes('biogas') ||
          method.includes('methane') ||
          method.includes('energy')
        ) {
          method = 'biogas';
        } else if (method.includes('material') || method.includes('extract')) {
          method = 'material_recovery';
        } else if (method.includes('dispos') || method.includes('trash')) {
          method = 'separate_disposal';
        } else if (method.includes('reuse')) {
          method = 'reuse';
        } else {
          method = wasteType === 'inorganic' ? 'material_recovery' : 'composting';
        }

        return {
          method,
          reason:
            opt.reason ||
            opt.explanation ||
            opt.description ||
            'Suitable circular resource pathway.',
          requirements:
            opt.requirements ||
            opt.conditions ||
            'Ensure materials are segregated and uncontaminated.',
          estimated_value:
            opt.estimated_value || opt.estimatedValue || 'Circular value preservation'
        };
      })
      .filter(Boolean);

    // If no recovery options supplied, synthesize intelligent defaults based on item
    if (recoveryOptions.length === 0) {
      if (wasteType === 'inorganic') {
        if (condition === 'new_surplus' || condition === 'reusable_intact') {
          recoveryOptions = [
            {
              method: 'reuse',
              reason: 'Component is intact and within functional tolerances; redeploy directly.',
              requirements: 'Inspect interfaces and verify electrical/mechanical specs.',
              estimated_value: 'High (Immediate hardware replacement savings)'
            },
            {
              method: 'redistribution',
              reason: 'Divert surplus hardware into secondary industrial surplus marketplaces.',
              requirements: 'Clean and package in protective ESD/anti-corrosion wrapping.',
              estimated_value: 'Medium-High (50–70% of original equipment cost)'
            }
          ];
        } else if (condition === 'minor_wear_refurbishable') {
          recoveryOptions = [
            {
              method: 'refurbishment',
              reason:
                'Ultrasonic cleaning, repacking, and calibration will restore operational readiness.',
              requirements: 'Clean thoroughly and check dimensional clearances.',
              estimated_value: 'Medium (Extends asset operational lifecycle)'
            },
            {
              method: 'component_harvesting',
              reason: 'Extract undamaged sub-components (copper coils, bearings, discrete ICs).',
              requirements: 'Use desoldering station or mechanical disassembly jigs.',
              estimated_value: 'Medium (Component salvage inventory value)'
            }
          ];
        } else if (foodCategory === 'electronic_ewaste') {
          recoveryOptions = [
            {
              method: 'component_harvesting',
              reason: 'Salvage high-value microcontrollers, power transistors, and heatsinks.',
              requirements: 'Use ESD grounding and low-temperature hot air desoldering.',
              estimated_value: 'High ($10–$50 salvaged electronic component value)'
            },
            {
              method: 'precious_metal_recovery',
              reason: 'Smelt and hydrometallurgically refine gold, silver, copper, and palladium.',
              requirements: 'Send depopulated boards to certified WEEE R4 smelting refiners.',
              estimated_value: 'High ($3,000–$15,000/ton refined e-scrap yield)'
            }
          ];
        } else if (foodCategory === 'industrial_scrap_metal') {
          recoveryOptions = [
            {
              method: 'scrap_recycling',
              reason:
                'Melt segregated alloy into secondary billet/ingot with up to 95% energy savings.',
              requirements: 'Keep ferrous and non-ferrous alloys strictly segregated.',
              estimated_value: 'High (Market scrap commodity value: $2.50–$8.00/kg)'
            }
          ];
        } else if (foodCategory === 'engineering_polymer') {
          recoveryOptions = [
            {
              method: 'chemical_recycling',
              reason: 'Shred, wash, and re-pelletize thermoplastic resin for injection molding.',
              requirements:
                'Avoid mixing dissimilar polymer resin codes (e.g. keep HDPE and PP separate).',
              estimated_value: 'Medium ($1.20–$2.40/kg clean recycled regrind value)'
            }
          ];
        } else if (foodCategory === 'battery_storage' || foodCategory === 'chemical_hazardous') {
          recoveryOptions = [
            {
              method: 'hazardous_neutralization',
              reason:
                'Isolate specialized hazardous material and route to closed-loop hydrometallurgical recycling.',
              requirements:
                'Tape battery terminals; store in fire-retardant vermiculite container.',
              estimated_value: 'Safety & Regulatory Compliance'
            }
          ];
        } else {
          recoveryOptions = [
            {
              method: 'material_recovery',
              reason: 'Segregate material core for secondary industrial recycling and remelting.',
              requirements: 'Remove contaminants, fasteners, and foreign residues.',
              estimated_value: 'Material recovery and landfill diversion'
            }
          ];
        }
      } else {
        // Organic defaults
        if (wasteCategory === 'edible_reusable') {
          recoveryOptions = [
            {
              method: 'reuse',
              reason: 'Repurpose for culinary, household, or functional preparations.',
              requirements: 'Ensure clean and uncontaminated handling.',
              estimated_value: 'Direct culinary savings'
            },
            {
              method: 'composting',
              reason:
                'Clean plant residue will compost rapidly into organic humic soil conditioner.',
              requirements: 'Keep free from packaging or chemicals.',
              estimated_value: 'Soil organic carbon enhancement'
            }
          ];
        } else if (wasteCategory === 'surplus_redistributable') {
          recoveryOptions = [
            {
              method: 'redistribution',
              reason: 'Wholesome surplus food suitable for donation before quality declines.',
              requirements: 'Maintain temperature and transport in clean food-grade containers.',
              estimated_value: 'High social and community nutrition impact'
            }
          ];
        } else {
          recoveryOptions = [
            {
              method: 'reuse',
              reason: 'Extract functional plant compounds or prepare concentrated broths/extracts.',
              requirements: 'Rinse thoroughly before preparation.',
              estimated_value: 'Repurposing value'
            },
            {
              method: 'composting',
              reason: 'Biodegradable organic residue provides humic matter and moisture for soil.',
              requirements: 'Chop coarsely to accelerate microbial digestion.',
              estimated_value: 'Soil regeneration and landfill methane diversion'
            }
          ];
        }
      }
    }

    // 9. Reuse / Harvesting suggestions
    let reuseSuggestions = [];
    if (Array.isArray(item?.reuse_suggestions)) {
      reuseSuggestions = item.reuse_suggestions.filter((s) => typeof s === 'string' && s.trim());
    }
    if (reuseSuggestions.length === 0) {
      if (wasteType === 'inorganic') {
        reuseSuggestions = [
          'Harvest reusable discrete components, fasteners, or wiring for workshop prototypes',
          'Repurpose structural alloy brackets or frames into workshop fixtures and jigs',
          'Route decontaminated material to local maker spaces, repair cafes, or certified scrap recyclers'
        ];
      } else {
        reuseSuggestions = [
          'Compost organic residue to enrich garden soil',
          'Extract natural plant moisture or essences for household preparation'
        ];
      }
    }

    // 10. Hazard alerts
    let hazardAlerts = [];
    if (Array.isArray(item?.hazard_alerts)) {
      hazardAlerts = item.hazard_alerts.filter((s) => typeof s === 'string' && s.trim());
    }
    if (hazardAlerts.length === 0 && wasteType === 'inorganic') {
      if (foodCategory === 'electronic_ewaste' || foodCategory === 'battery_storage') {
        hazardAlerts = [
          'Electrical charge hazard: Discharge high-voltage electrolytic capacitors before handling',
          'Chemical hazard: Avoid puncturing cells or inhaling lead/cadmium solder fumes'
        ];
      } else if (
        foodCategory === 'industrial_scrap_metal' ||
        foodCategory === 'mechanical_hardware'
      ) {
        hazardAlerts = [
          'Mechanical hazard: Wear cut-resistant gloves to protect against sharp burrs and shear edges',
          'Chemical hazard: Degrease cutting oil residues in a well-ventilated area'
        ];
      }
    }

    return {
      food_name: itemName,
      waste_type: wasteType,
      food_category: foodCategory,
      waste_category: wasteCategory,
      condition,
      condition_details: conditionDetails,
      reusability_score: reusabilityScore,
      confidence,
      estimated_quantity: estimatedQuantity,
      estimated_unit: estimatedUnit,
      bounding_box: boundingBox,
      recovery_options: recoveryOptions,
      reuse_suggestions: reuseSuggestions,
      hazard_alerts: hazardAlerts
    };
  });

  const notes =
    (typeof raw.notes === 'string' && raw.notes.trim()) ||
    'Material condition and circular recovery pathways evaluated via AI vision inspection.';

  return {
    items: normalizedItems,
    notes
  };
}

/**
 * Calls Google Gemini API using the user's decrypted API key.
 * Analyzes both organic food residues and inorganic industrial, mechanical,
 * electronic, and engineering waste with equal precision.
 *
 * @param {string} apiKey - Decrypted Gemini API key (passed via x-goog-api-key header)
 * @param {string} imageBase64 - Clean base64 string of the image (without data URL prefix)
 * @param {string} mimeType - Image mime type ('image/jpeg', 'image/png', 'image/webp')
 * @param {string} [modelOverride] - Optional model identifier
 * @returns {Promise<z.infer<typeof geminiAnalysisSchema>>} Validated analysis result
 */
export async function analyzeFoodImageWithGemini(
  apiKey,
  imageBase64,
  mimeType = 'image/jpeg',
  modelOverride = null
) {
  // Clean apiKey of accidental surrounding quotes or invisible whitespace
  const cleanKey = (apiKey || '')
    .trim()
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0\s]/g, '');

  const defaultModel = process.env.DEFAULT_GEMINI_MODEL || 'gemini-3.1-flash-lite';
  const modelsToTry = modelOverride
    ? [modelOverride]
    : [
        defaultModel,
        'gemini-3.1-flash-lite',
        'gemini-2.5-flash-lite',
        'gemini-2.5-flash',
        'gemini-1.5-flash'
      ].filter((v, i, a) => a.indexOf(v) === i);

  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

  const payload = {
    contents: [
      {
        parts: [
          {
            text: SYSTEM_INSTRUCTION
          },
          {
            text: 'Inspect this image carefully. Identify all waste items, surplus materials, scrap, components, electronics, hardware, or organic residues. Detect condition, reusability, material type, 2D bounding boxes, and circular recovery pathways. Return ONLY JSON conforming strictly to the response schema.'
          },
          {
            inline_data: {
              mime_type: mimeType,
              data: cleanBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.1
    }
  };

  let response;

  for (let i = 0; i < modelsToTry.length; i++) {
    const currentModel = modelsToTry[i];
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(currentModel)}:generateContent`;

    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': cleanKey
        },
        body: JSON.stringify(payload)
      });
    } catch {
      const error = new Error('Failed to communicate with Google Gemini API.');
      error.code = 'GEMINI_UNAVAILABLE';
      error.status = 503;
      throw error;
    }

    if ((response.status === 404 || response.status === 400) && i < modelsToTry.length - 1) {
      console.warn(
        `Model ${currentModel} returned status ${response.status}, attempting fallback to ${modelsToTry[i + 1]}`
      );
      continue;
    }

    break;
  }

  // Handle HTTP error responses
  if (!response || !response.ok) {
    const status = response?.status || 500;
    let errData = {};
    try {
      errData = await response.json();
    } catch {
      // non-JSON error
    }

    const message = errData.error?.message || `Gemini API returned status ${status}`;

    if (
      status === 401 ||
      status === 403 ||
      (status === 400 && message.toLowerCase().includes('api key'))
    ) {
      const err = new Error('The provided Gemini API key is invalid or has been revoked.');
      err.code = 'API_KEY_INVALID';
      err.status = 401;
      throw err;
    }

    if (
      status === 429 ||
      message.toLowerCase().includes('quota') ||
      message.toLowerCase().includes('resource_exhausted')
    ) {
      const err = new Error(
        'Gemini API quota exceeded for your key. Please check your quota on Google AI Studio.'
      );
      err.code = 'QUOTA_EXCEEDED';
      err.status = 429;
      throw err;
    }

    const err = new Error('Google Gemini was unable to process the image: ' + message);
    err.code = 'GEMINI_ERROR';
    err.status = 502;
    throw err;
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    const err = new Error('Gemini returned an empty response for this image.');
    err.code = 'GEMINI_EMPTY_RESPONSE';
    err.status = 502;
    throw err;
  }

  const cleanedText = rawText
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  let parsedJson;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch {
    const err = new Error('Gemini response could not be parsed as valid JSON.');
    err.code = 'INVALID_AI_SCHEMA';
    err.status = 502;
    throw err;
  }

  const normalizedData = normalizeGeminiOutput(parsedJson);

  const validationResult = geminiAnalysisSchema.safeParse(normalizedData);
  if (!validationResult.success) {
    console.warn('Gemini schema validation issue:', validationResult.error.format());
    const err = new Error(
      'AI output failed schema validation: ' +
        (validationResult.error.errors[0]?.message || 'Invalid output format')
    );
    err.code = 'INVALID_AI_SCHEMA';
    err.status = 502;
    throw err;
  }

  return validationResult.data;
}
