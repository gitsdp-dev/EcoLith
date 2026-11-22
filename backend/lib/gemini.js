import { z } from 'zod';

/**
 * Zod validation schema for Gemini food waste analysis output.
 * Ensures the response strictly complies with database schema checks and AGENTS.md contract.
 */
const recoveryOptionSchema = z.object({
  method: z.enum([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ]),
  reason: z.string().default(''),
  requirements: z.string().default('')
});

const foodItemSchema = z.object({
  food_name: z.string().min(1, 'Food name is required'),
  food_category: z.string().default('vegetable'),
  waste_category: z.enum([
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ]),
  confidence: z.number().min(0).max(1).default(0.85),
  estimated_quantity: z.number().min(0.001).default(1),
  estimated_unit: z.enum(['g', 'kg', 'piece', 'ml', 'l']).default('g'),
  bounding_box: z.array(z.number()).length(4).optional().nullable(),
  recovery_options: z.array(recoveryOptionSchema).default([]),
  reuse_suggestions: z.array(z.string()).default([])
});

export const geminiAnalysisSchema = z.object({
  items: z.array(foodItemSchema).default([]),
  notes: z
    .string()
    .default('Contamination and edibility cannot be reliably assessed from a photo alone.')
});

/**
 * System instruction and prompt guidelines for food waste analysis.
 * Explicitly optimized for Gemini 3.1 Flash-Lite vision and precise waste detection.
 */
const SYSTEM_INSTRUCTION = `You are EcoLith AI, an expert food waste intelligence, computer vision, and circular resource recovery specialist.
Analyze the provided image of food waste, kitchen scraps, organic residues, or surplus food.
Output ONLY valid JSON conforming strictly to the requested schema.

CRITICAL INSTRUCTIONS:

1. EMPTY SCANS OR NON-FOOD DETECTION:
   - Carefully inspect the image first.
   - If the image DOES NOT contain any food, food waste, kitchen scraps, agricultural residue, or surplus food (e.g. blank background, wall, desk, floor, furniture, electronics, empty plate, clothing, or non-food objects), you MUST return an empty items array: "items": [] and note in "notes": "No food waste or organic residue detected in image."
   - NEVER hallucinate, invent, or guess food items if none are visible!

2. 2D BOUNDING BOX OBJECT DETECTION (GREEN BOX):
   - For every detected organic waste or food item, accurately supply its "bounding_box" as an array of 4 integers [ymin, xmin, ymax, xmax] normalized on a scale from 0 to 1000, where (0,0) is top-left and (1000,1000) is bottom-right.
   - The bounding box must tightly enclose the detected item so that a live green box can be drawn accurately around the waste.

3. ACCURATE FOOD CATEGORY:
   - Select the most precise food category for each item: 'fruit', 'vegetable', 'plant_material', 'bakery', 'grain', 'dairy', 'meat_fish', 'prepared_food', 'beverage', or 'other'.
   - DO NOT default to 'other'! Examples:
     * Banana peel, orange peel, apple core, lemon rind, melon rind -> 'fruit'
     * Potato peel, onion skin, carrot greens, vegetable scraps -> 'vegetable'
     * Aloe vera leaf/cutting, botanical foliage, garden leaves, succulents -> 'plant_material'
     * Stale bread, toast, croissant, bakery surplus -> 'bakery'
     * Cooked rice, pasta, noodles, grains -> 'grain'
     * Spent coffee grounds, used tea leaves -> 'beverage'
     * Cheese rinds, expired milk/yogurt -> 'dairy'
     * Bones, meat scraps, eggshells -> 'meat_fish'
     * Cooked meals, leftovers, curries -> 'prepared_food'

4. WASTE STREAM CLASSIFICATION (SAFETY & EDIBILITY):
   - Inedible parts, rinds, skins, bones, and shells MUST ALWAYS be classified as 'unavoidable_organic'. NEVER classify them as 'edible_reusable' or 'surplus_redistributable'!
   - SPECIFICALLY: Aloe Vera leaves/rinds, banana peels, citrus peels, potato skins, onion skins, apple cores, avocado peels/pits, eggshells, coffee grounds, and bones are UNAVOIDABLE RESIDUES ('unavoidable_organic').
   - 'edible_reusable': Reserved ONLY for genuinely safe, edible food portions (e.g. leftover rice, edible vegetable trimmings like carrot greens, bread crusts).
   - 'surplus_redistributable': Reserved ONLY for wholesome, untouched, unexpired whole surplus food suitable for donation.
   - 'other_separate': Contaminated materials, spent cooking oil, or non-food packaging.

5. REALISTIC QUANTITY ESTIMATION:
   - Visually estimate the real-world mass or piece count based on visual scale. DO NOT default everything to 1 kg!
   - Realistic benchmarks:
     * A single leaf (aloe vera leaf, spinach, mint, tea leaf): 5-20 g, or 1 piece.
     * A single fruit/vegetable peel (banana peel, orange rind): 25-50 g, or 1 piece.
     * An apple core or vegetable trimmings: 20-40 g.
     * Used coffee grounds (single cup): 15-25 g.
     * An eggshell: 5-8 g, or 1 piece.
     * Leftover plate portion: 150-350 g.
     * Large bulk quantities (commercial bins, crates): only then use kg or l.
   - Provide "estimated_quantity" (number) and "estimated_unit" ('g', 'kg', 'piece', 'ml', 'l').

6. CIRCULAR RECOVERY PATHWAYS & REUSE SUGGESTIONS:
   - Provide realistic circular recovery pathways ('reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal') and 1-3 creative household/craft/culinary reuse ideas.
   - State uncertainty honestly and do not guarantee microbial safety from photos.`;

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
          food_category: {
            type: 'STRING',
            enum: [
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
          confidence: { type: 'NUMBER' },
          estimated_quantity: { type: 'NUMBER' },
          estimated_unit: {
            type: 'STRING',
            enum: ['g', 'kg', 'piece', 'ml', 'l']
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
                    'separate_disposal'
                  ]
                },
                reason: { type: 'STRING' },
                requirements: { type: 'STRING' }
              },
              required: ['method', 'reason']
            }
          },
          reuse_suggestions: {
            type: 'ARRAY',
            items: { type: 'STRING' }
          }
        },
        required: ['food_name', 'waste_category']
      }
    },
    notes: { type: 'STRING' }
  },
  required: ['items']
};

/**
 * Keywords for inedible plant/food residues that MUST NOT be classified as edible.
 */
const INEDIBLE_RESIDUE_PATTERN =
  /peel|rind|skin|aloe|leaf|leaves|foliage|bone|shell|pit|core|seed|stalk|stem|ground|grounds|inedible|hull|husk|pod|chaff/i;

/**
 * Normalizes raw or irregular Gemini output into strict compliance with EcoLith schema:
 * - Accurately preserves empty detections (no hallucinated fake items)
 * - Enforces inedibility rule (Aloe vera and peels cannot be edible)
 * - Accurately categorizes food categories instead of defaulting to 'other'
 * - Estimates realistic quantities for small items (e.g. 10g for a leaf instead of 1kg)
 * - Normalizes 2D bounding boxes for live green box visualization
 */
export function normalizeGeminiOutput(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      items: [],
      notes: 'No food waste or organic residue detected in image.'
    };
  }

  // Handle explicit empty arrays or no-detection indications
  if (Array.isArray(raw.items) && raw.items.length === 0) {
    return {
      items: [],
      notes: raw.notes || 'No food waste or organic residue detected in image.'
    };
  }

  // If raw is an empty object without food identification
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
      notes: raw.notes || 'No food waste or organic residue detected in image.'
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
    // Single object returned directly by Gemini
    itemsList = [raw];
  } else if (raw.item && typeof raw.item === 'object') {
    itemsList = [raw.item];
  }

  // Filter out any invalid items
  itemsList = itemsList.filter((it) => it && typeof it === 'object' && (it.food_name || it.name || it.item_name || it.title));

  // If no identifiable food items remain, return empty items array
  if (itemsList.length === 0) {
    return {
      items: [],
      notes: raw.notes || 'No food waste or organic residue detected in image.'
    };
  }

  const VALID_WASTE_CATEGORIES = new Set([
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ]);

  const VALID_RECOVERY_METHODS = new Set([
    'reuse',
    'redistribution',
    'composting',
    'biogas',
    'pectin_recovery',
    'material_recovery',
    'separate_disposal'
  ]);

  const normalizedItems = itemsList.map((item, idx) => {
    const foodName =
      (typeof item === 'object' &&
        (item.food_name || item.name || item.item_name || item.title)) ||
      `Item ${idx + 1}`;

    // Precise Food Category inference
    let rawCategory =
      (typeof item === 'object' && (item.food_category || item.category || item.type)) || '';
    let foodCategory = String(rawCategory).toLowerCase().trim().replace(/[\s-]+/g, '_');

    // Intelligent keyword-based category resolution to eliminate 'other' default
    const nameLower = foodName.toLowerCase();
    if (
      foodCategory === 'other' ||
      foodCategory === '' ||
      foodCategory === 'organic' ||
      foodCategory === 'produce' ||
      foodCategory === 'plant'
    ) {
      if (/aloe|leaf|leaves|succulent|cactus|foliage|flower|garden|grass|stem/i.test(nameLower)) {
        foodCategory = 'plant_material';
      } else if (
        /banana|apple|orange|citrus|lemon|lime|melon|grape|berry|mango|pear|peach|fruit|peel|rind|zest/i.test(
          nameLower
        )
      ) {
        foodCategory = 'fruit';
      } else if (
        /potato|carrot|onion|tomato|broccoli|cabbage|lettuce|cucumber|pepper|squash|spinach|herb|vegetable|greens|trimmings/i.test(
          nameLower
        )
      ) {
        foodCategory = 'vegetable';
      } else if (/bread|crust|bagel|pastry|croissant|toast|bun|cake|bakery/i.test(nameLower)) {
        foodCategory = 'bakery';
      } else if (/rice|pasta|noodle|cereal|oat|grain|flour/i.test(nameLower)) {
        foodCategory = 'grain';
      } else if (/coffee|tea|grounds|brew|juice|drink|beverage/i.test(nameLower)) {
        foodCategory = 'beverage';
      } else if (/cheese|milk|yogurt|butter|dairy/i.test(nameLower)) {
        foodCategory = 'dairy';
      } else if (/bone|chicken|meat|beef|pork|fish|seafood|egg|eggshell/i.test(nameLower)) {
        foodCategory = 'meat_fish';
      } else if (/curry|soup|stew|meal|leftover|cooked|rice/i.test(nameLower)) {
        foodCategory = 'prepared_food';
      } else {
        foodCategory = 'vegetable';
      }
    }

    // Map waste_category
    let wasteCategory = typeof item === 'object' ? item.waste_category : null;
    if (typeof wasteCategory === 'string') {
      const lower = wasteCategory.toLowerCase().trim().replace(/[\s-]+/g, '_');
      if (VALID_WASTE_CATEGORIES.has(lower)) {
        wasteCategory = lower;
      } else if (lower.includes('edible') || lower.includes('reusable')) {
        wasteCategory = 'edible_reusable';
      } else if (
        lower.includes('surplus') ||
        lower.includes('redistribut') ||
        lower.includes('donat')
      ) {
        wasteCategory = 'surplus_redistributable';
      } else if (
        lower.includes('separate') ||
        lower.includes('hazard') ||
        lower.includes('oil') ||
        lower.includes('packaging')
      ) {
        wasteCategory = 'other_separate';
      } else {
        wasteCategory = 'unavoidable_organic';
      }
    } else {
      wasteCategory = 'unavoidable_organic';
    }

    // MANDATORY RULE: Inedible fruit/vegetable peels, aloe vera, bones, eggshells, etc. CANNOT be edible
    if (
      (wasteCategory === 'edible_reusable' || wasteCategory === 'surplus_redistributable') &&
      (INEDIBLE_RESIDUE_PATTERN.test(foodName) ||
        nameLower.includes('aloe') ||
        nameLower.includes('peel') ||
        nameLower.includes('rind') ||
        nameLower.includes('skin') ||
        nameLower.includes('core'))
    ) {
      wasteCategory = 'unavoidable_organic';
    }

    // Confidence
    let confidence = 0.92;
    if (typeof item?.confidence === 'number' && !isNaN(item.confidence)) {
      confidence = Math.max(0, Math.min(1, item.confidence));
    }

    // Realistic Quantity & Unit estimation (prevent single leaf defaulting to 1kg)
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
      ['g', 'kg', 'piece', 'ml', 'l'].includes(item.estimated_unit.toLowerCase())
    ) {
      estimatedUnit = item.estimated_unit.toLowerCase();
    } else {
      // Intelligently infer realistic metric unit based on item type
      if (/leaf|leaves|aloe|herb|sprig|peel|rind|skin|core|eggshell/i.test(nameLower)) {
        if (!item?.estimated_quantity || item.estimated_quantity >= 1) {
          estimatedQuantity =
            /leaf|leaves|aloe|herb/i.test(nameLower) ? 10 : 30;
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

    // Ensure small scraps are never 1 kg
    if (
      estimatedUnit === 'kg' &&
      estimatedQuantity >= 1 &&
      /leaf|leaves|peel|rind|skin|aloe|scrap|core|eggshell|grounds/i.test(nameLower)
    ) {
      estimatedQuantity = /leaf|aloe/i.test(nameLower) ? 10 : 35;
      estimatedUnit = 'g';
    }

    // 2D Bounding Box Normalization [ymin, xmin, ymax, xmax] (0 to 1000 scale)
    let boundingBox = null;
    const rawBox = item?.bounding_box || item?.box_2d || item?.box;
    if (Array.isArray(rawBox) && rawBox.length === 4) {
      let [ymin, xmin, ymax, xmax] = rawBox.map((v) => Number(v) || 0);

      // If coordinates were scaled to 0.0 - 1.0 floats, upscale to 0 - 1000
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
      // Sensible default detection bounding box centered on object
      boundingBox = [150, 150, 850, 850];
    }

    // Recovery options
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
        } else if (method.includes('compost')) {
          method = 'composting';
        } else if (
          method.includes('redistribut') ||
          method.includes('donat') ||
          method.includes('bank')
        ) {
          method = 'redistribution';
        } else if (method.includes('pectin')) {
          method = 'pectin_recovery';
        } else if (
          method.includes('biogas') ||
          method.includes('energy') ||
          method.includes('methane') ||
          method.includes('fuel')
        ) {
          method = 'biogas';
        } else if (
          method.includes('material') ||
          method.includes('extract') ||
          method.includes('fiber') ||
          method.includes('textile')
        ) {
          method = 'material_recovery';
        } else if (
          method.includes('separate') ||
          method.includes('dispos') ||
          method.includes('trash') ||
          method.includes('landfill')
        ) {
          method = 'separate_disposal';
        } else if (
          method.includes('reuse') ||
          method.includes('craft') ||
          method.includes('skin') ||
          method.includes('home')
        ) {
          method = 'reuse';
        } else {
          method = 'composting';
        }

        return {
          method,
          reason:
            opt.reason ||
            opt.explanation ||
            opt.description ||
            'Suitable circular recovery pathway.',
          requirements:
            opt.requirements ||
            opt.conditions ||
            'Ensure materials are segregated and uncontaminated.'
        };
      })
      .filter(Boolean);

    // If no recovery options provided, supply intelligent defaults based on item
    if (recoveryOptions.length === 0) {
      if (wasteCategory === 'edible_reusable') {
        recoveryOptions = [
          {
            method: 'reuse',
            reason: 'Item can be repurposed for culinary, household, or functional preparations.',
            requirements: 'Ensure clean and uncontaminated handling.'
          },
          {
            method: 'composting',
            reason: 'Clean plant material will compost rapidly.',
            requirements: 'Keep free from packaging or chemicals.'
          }
        ];
      } else if (wasteCategory === 'surplus_redistributable') {
        recoveryOptions = [
          {
            method: 'redistribution',
            reason: 'Wholesome surplus suitable for donation before quality declines.',
            requirements: 'Maintain temperature and transport in clean containers.'
          }
        ];
      } else {
        recoveryOptions = [
          {
            method: 'reuse',
            reason:
              'Extract functional plant compounds (e.g. soothing gel, natural extracts) or home preparations.',
            requirements: 'Rinse outer rind thoroughly before preparation.'
          },
          {
            method: 'composting',
            reason: 'Biodegradable plant residue provides organic matter and moisture for soil.',
            requirements: 'Chop thick rinds/leaves to accelerate microbial breakdown.'
          }
        ];
      }
    }

    // Reuse suggestions
    let reuseSuggestions = [];
    if (Array.isArray(item?.reuse_suggestions)) {
      reuseSuggestions = item.reuse_suggestions.filter((s) => typeof s === 'string' && s.trim());
    }
    if (reuseSuggestions.length === 0) {
      reuseSuggestions = [
        'Compost organic residue to enrich garden soil',
        'Extract natural plant moisture or functional essences for household or craft use'
      ];
    }

    return {
      food_name: foodName,
      food_category: foodCategory,
      waste_category: wasteCategory,
      confidence,
      estimated_quantity: estimatedQuantity,
      estimated_unit: estimatedUnit,
      bounding_box: boundingBox,
      recovery_options: recoveryOptions,
      reuse_suggestions: reuseSuggestions
    };
  });

  const notes =
    (typeof raw.notes === 'string' && raw.notes.trim()) ||
    'Contamination and edibility cannot be reliably assessed from a photo alone.';

  return {
    items: normalizedItems,
    notes
  };
}

/**
 * Calls Google Gemini API using the user's decrypted API key.
 * Uses gemini-3.1-flash-lite by default as the primary model.
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

  // High-accuracy model priority under Gemini API: gemini-3.1-flash-lite by default
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

  // Strip data: prefix if accidentally passed
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '').trim();

  const payload = {
    contents: [
      {
        parts: [
          {
            text: SYSTEM_INSTRUCTION
          },
          {
            text: 'Analyze the food waste, kitchen scraps, or organic materials visible in this photo. If no food waste is present, return items: []. Return only JSON conforming strictly to the response schema.'
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

    // If 404 (model not found) or 400 (e.g. responseSchema not supported on older preview), fallback to next model
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

    // Map 400 / 401 / 403 API key errors
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

    // Map 429 quota or rate limit errors
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

    // Generic Gemini error
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

  // Clean potential markdown fences (e.g. ```json ... ```)
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

  // Normalize structure into strict compliance before Zod safeParse
  const normalizedData = normalizeGeminiOutput(parsedJson);

  // Validate with Zod schema
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
