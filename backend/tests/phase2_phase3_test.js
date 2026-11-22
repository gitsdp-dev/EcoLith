import test from 'node:test';
import assert from 'node:assert/strict';
import { geminiAnalysisSchema, normalizeGeminiOutput } from '../lib/gemini.js';
import {
  DEFAULT_RECOVERY_RULES,
  getRecoveryRecommendations,
  RECOVERY_METHOD_METADATA,
  WASTE_CATEGORY_METADATA
} from '../../js/recovery.js';

test('Gemini Analysis Schema strictly validates conforming food waste JSON', () => {
  const validOutput = {
    items: [
      {
        food_name: 'Orange peel',
        food_category: 'fruit',
        waste_category: 'unavoidable_organic',
        confidence: 0.92,
        recovery_options: [
          {
            method: 'pectin_recovery',
            reason: 'Citrus peel is an abundant source of industrial-grade pectin.',
            requirements: 'Free of foreign plastic stickers.'
          },
          {
            method: 'composting',
            reason: 'Aerobic microbial decomposition.',
            requirements: 'Chop finely to speed up degradation.'
          }
        ],
        reuse_suggestions: ['Zest for baking', 'Infuse in vinegar for cleaning spray']
      }
    ],
    notes: 'Contamination cannot be assessed from a photo.'
  };

  const parsed = geminiAnalysisSchema.safeParse(validOutput);
  assert.equal(parsed.success, true, 'Conforming output must pass validation');
  assert.equal(parsed.data.items[0].food_name, 'Orange peel');
  assert.equal(parsed.data.items[0].waste_category, 'unavoidable_organic');
  assert.equal(parsed.data.items[0].recovery_options.length, 2);
});

test('Gemini Analysis Schema rejects invalid waste_category or recovery_method enum', () => {
  const invalidCategory = {
    items: [
      {
        food_name: 'Apple core',
        food_category: 'fruit',
        waste_category: 'illegal_category_value', // Invalid
        confidence: 0.8,
        recovery_options: [],
        reuse_suggestions: []
      }
    ]
  };

  const invalidMethod = {
    items: [
      {
        food_name: 'Apple core',
        food_category: 'fruit',
        waste_category: 'unavoidable_organic',
        confidence: 0.8,
        recovery_options: [
          {
            method: 'burn_in_backyard', // Invalid method
            reason: 'Bad advice',
            requirements: 'None'
          }
        ],
        reuse_suggestions: []
      }
    ]
  };

  assert.equal(geminiAnalysisSchema.safeParse(invalidCategory).success, false);
  assert.equal(geminiAnalysisSchema.safeParse(invalidMethod).success, false);
});

test('normalizeGeminiOutput self-heals aloe vera leaf scan or single-item outputs', () => {
  // Simulates Gemini returning a single object (e.g. for an aloe vera leaf) without an "items" wrapper or missing waste_category
  const singleAloeVeraOutput = {
    food_name: 'Aloe vera leaf',
    food_category: 'plant',
    recovery_options: [
      {
        method: 'reuse',
        reason: 'Extract soothing clear inner gel for skincare hydration and cooling.',
        requirements: 'Rinse outer rind thoroughly.'
      },
      {
        method: 'compost', // fuzzy name: compost -> composting
        reason: 'Organic green matter rich in moisture and minerals.'
      }
    ],
    reuse_suggestions: ['Scrape gel for face and skin', 'Blend for organic garden fertilizer']
  };

  const normalized = normalizeGeminiOutput(singleAloeVeraOutput);
  assert.ok(Array.isArray(normalized.items), 'Must be wrapped into items array');
  assert.equal(normalized.items.length, 1);
  assert.equal(normalized.items[0].food_name, 'Aloe vera leaf');
  assert.equal(normalized.items[0].waste_category, 'unavoidable_organic');
  assert.equal(normalized.items[0].recovery_options[1].method, 'composting');

  // Verify it strictly passes geminiAnalysisSchema
  const parseResult = geminiAnalysisSchema.safeParse(normalized);
  assert.equal(parseResult.success, true, 'Normalized output must pass geminiAnalysisSchema without errors');
});

test('Circular Recovery Seed contains comprehensive taxonomy of at least 20 valid rules', () => {
  assert.ok(
    DEFAULT_RECOVERY_RULES.length >= 20,
    'Must have at least 20 rules for comprehensive coverage'
  );

  const validMethods = [
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ];

  const validWasteCategories = [
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ];

  for (const rule of DEFAULT_RECOVERY_RULES) {
    assert.ok(rule.material_pattern, 'Rule must define material_pattern');
    assert.ok(
      validWasteCategories.includes(rule.waste_category),
      `Waste category ${rule.waste_category} must be in allowed DB check enum`
    );
    assert.ok(
      validMethods.includes(rule.recovery_method),
      `Recovery method ${rule.recovery_method} must be in allowed DB check enum`
    );
    assert.ok(rule.explanation, 'Rule must provide clear explanation');
    assert.ok(rule.requirements, 'Rule must specify facility/contamination conditions');
  }
});

test('Recovery recommendations correctly match diverse food waste streams', async () => {
  // Test 1: Citrus Peels
  const citrusRecs = await getRecoveryRecommendations(
    'Orange peel',
    'unavoidable_organic',
    'fruit'
  );
  assert.ok(citrusRecs.length > 0);
  const citrusMethods = citrusRecs.map((r) => r.method);
  assert.ok(
    citrusMethods.includes('pectin_recovery') || citrusMethods.includes('composting'),
    'Citrus peel should suggest pectin recovery or composting'
  );

  // Test 2: Spent Coffee Grounds
  const coffeeRecs = await getRecoveryRecommendations(
    'Used coffee grounds',
    'unavoidable_organic',
    'beverage'
  );
  assert.ok(coffeeRecs.length > 0);
  assert.ok(
    coffeeRecs.some((r) => r.method === 'material_recovery'),
    'Coffee grounds should suggest material recovery (mushroom substrate)'
  );

  // Test 3: Surplus Bakery
  const bakeryRecs = await getRecoveryRecommendations(
    'Surplus bread loaves',
    'surplus_redistributable',
    'bakery'
  );
  assert.ok(bakeryRecs.length > 0);
  assert.ok(
    bakeryRecs.some((r) => r.method === 'redistribution'),
    'Surplus bread should suggest food bank redistribution'
  );

  // Test 4: Cooking Oil / Grease
  const oilRecs = await getRecoveryRecommendations('Used deep fryer oil', 'other_separate', 'oil');
  assert.ok(oilRecs.length > 0);
  assert.ok(
    oilRecs.some((r) => r.method === 'material_recovery'),
    'Used cooking oil should suggest material recovery (biodiesel)'
  );

  // Test 5: Seafood & Crustacean Shells
  const seafoodRecs = await getRecoveryRecommendations(
    'Shrimp tails and crab shells',
    'unavoidable_organic',
    'seafood'
  );
  assert.ok(seafoodRecs.length > 0);
  assert.ok(
    seafoodRecs.some((r) => r.method === 'material_recovery'),
    'Crustacean shells should suggest chitin material recovery'
  );

  // Test 6: Spent Brewer Grain
  const brewerRecs = await getRecoveryRecommendations(
    'Spent barley grain mash',
    'unavoidable_organic',
    'grain'
  );
  assert.ok(brewerRecs.length > 0);
  assert.ok(
    brewerRecs.some((r) => r.method === 'material_recovery'),
    'Spent grain should suggest animal feed / upcycled flour'
  );
});

test('Universal keyword inference and fallback covers arbitrary or exotic food items', async () => {
  // Unlisted exotic fruit skin
  const exoticFruit = await getRecoveryRecommendations(
    'Exotic dragonfruit peel',
    'unavoidable_organic',
    'fruit'
  );
  assert.ok(exoticFruit.length > 0, 'Must match via keyword inference');
  assert.ok(exoticFruit.some((r) => r.method === 'composting' || r.method === 'pectin_recovery'));

  // Unlisted meat scrap
  const beefMarrow = await getRecoveryRecommendations(
    'Beef marrow bone',
    'unavoidable_organic',
    'protein'
  );
  assert.ok(beefMarrow.length > 0);
  assert.ok(beefMarrow.some((r) => r.method === 'reuse' || r.method === 'biogas'));

  // Completely unknown arbitrary item
  const unknownItem = await getRecoveryRecommendations(
    'Zyxwvu organic residue',
    'unavoidable_organic',
    'other'
  );
  assert.ok(unknownItem.length > 0, 'Universal fallback must always produce at least one pathway');
  assert.equal(unknownItem[0].method, 'composting');
});

test('Metadata definitions cover all database check enum values', () => {
  const dbMethods = [
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ];

  for (const method of dbMethods) {
    assert.ok(RECOVERY_METHOD_METADATA[method], `RECOVERY_METHOD_METADATA must define ${method}`);
    assert.ok(RECOVERY_METHOD_METADATA[method].label, `${method} must have human readable label`);
    assert.ok(RECOVERY_METHOD_METADATA[method].icon, `${method} must have icon`);
  }

  const dbCategories = [
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ];

  for (const cat of dbCategories) {
    assert.ok(WASTE_CATEGORY_METADATA[cat], `WASTE_CATEGORY_METADATA must define ${cat}`);
    assert.ok(WASTE_CATEGORY_METADATA[cat].label, `${cat} must have label`);
  }
});

test('normalizeGeminiOutput accurately returns empty items on blank or non-food scans', () => {
  // Empty items array from Gemini
  const emptyOutput = { items: [], notes: 'No food waste detected.' };
  const normalizedEmpty = normalizeGeminiOutput(emptyOutput);
  assert.equal(normalizedEmpty.items.length, 0, 'Must not fabricate items for empty scans');

  // Blank object
  const blankOutput = {};
  const normalizedBlank = normalizeGeminiOutput(blankOutput);
  assert.equal(normalizedBlank.items.length, 0, 'Must not fabricate items for blank objects');
});

test('Inedible peels and Aloe Vera cannot be classified as edible', () => {
  // Attempting to pass banana peel as edible_reusable
  const peelInput = {
    food_name: 'Banana peel',
    waste_category: 'edible_reusable',
    confidence: 0.95
  };
  const normalizedPeel = normalizeGeminiOutput(peelInput);
  assert.equal(
    normalizedPeel.items[0].waste_category,
    'unavoidable_organic',
    'Inedible banana peel must be converted to unavoidable_organic'
  );

  // Attempting to pass aloe vera as surplus_redistributable
  const aloeInput = {
    food_name: 'Aloe vera leaf',
    waste_category: 'surplus_redistributable',
    confidence: 0.92
  };
  const normalizedAloe = normalizeGeminiOutput(aloeInput);
  assert.equal(
    normalizedAloe.items[0].waste_category,
    'unavoidable_organic',
    'Aloe vera leaf must be converted to unavoidable_organic'
  );
});

test('Leaf and peel quantities are realistically estimated in grams, not kilograms', () => {
  const leafInput = {
    food_name: 'Aloe vera leaf cutting',
    estimated_quantity: 1.0,
    estimated_unit: 'kg' // Unrealistic 1kg default
  };
  const normalizedLeaf = normalizeGeminiOutput(leafInput);
  assert.equal(normalizedLeaf.items[0].estimated_unit, 'g', 'Single leaf must not be measured in kg');
  assert.ok(normalizedLeaf.items[0].estimated_quantity < 50, 'Leaf quantity must be under 50 grams');
});

test('Bounding box coordinates are properly normalized and clamped to 0-1000', () => {
  const itemWithFloatBox = {
    food_name: 'Orange peel',
    bounding_box: [0.15, 0.2, 0.85, 0.9] // float format (0-1)
  };
  const normalized = normalizeGeminiOutput(itemWithFloatBox);
  assert.deepEqual(
    normalized.items[0].bounding_box,
    [150, 200, 850, 900],
    'Float coordinates must be scaled to 0-1000 integers'
  );
});

test('Food category is intelligently classified from food name and never left as other', () => {
  const citrusInput = {
    food_name: 'Orange peel',
    food_category: 'other' // Accidental 'other'
  };
  const normalized = normalizeGeminiOutput(citrusInput);
  assert.equal(normalized.items[0].food_category, 'fruit', 'Orange peel category must be fruit');

  const aloeInput = {
    food_name: 'Aloe vera plant residue',
    food_category: 'other'
  };
  const normalizedAloe = normalizeGeminiOutput(aloeInput);
  assert.equal(
    normalizedAloe.items[0].food_category,
    'plant_material',
    'Aloe vera category must be plant_material'
  );
});
