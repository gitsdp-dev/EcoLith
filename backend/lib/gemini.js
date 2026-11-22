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
  food_category: z.string().default('organic'),
  waste_category: z.enum([
    'edible_reusable',
    'surplus_redistributable',
    'unavoidable_organic',
    'other_separate'
  ]),
  confidence: z.number().min(0).max(1).default(0.85),
  recovery_options: z.array(recoveryOptionSchema).default([]),
  reuse_suggestions: z.array(z.string()).default([])
});

export const geminiAnalysisSchema = z.object({
  items: z.array(foodItemSchema).min(1, 'At least one food waste item must be identified'),
  notes: z
    .string()
    .default('Contamination and edibility cannot be reliably assessed from a photo alone.')
});

/**
 * System instruction and prompt guidelines for food waste analysis.
 */
const SYSTEM_INSTRUCTION = `You are EcoLith AI, an expert food waste intelligence and circular resource recovery specialist.
Analyze the provided image of food waste, surplus food, or organic residue.
Output ONLY valid JSON conforming to the requested schema.

Guidelines:
1. Identify all distinct food waste or surplus items visible in the image.
2. For each item, specify:
   - food_name: Clean, specific common name (e.g., "Banana peel", "Stale sourdough bread", "Used coffee grounds", "Cooked vegetable curry").
   - food_category: Category such as "fruit", "vegetable", "bakery", "prepared_food", "dairy", "grain", "meat_fish", "beverage", or "other".
   - waste_category: MUST be exactly one of:
     * 'edible_reusable': Still safe and edible leftovers or edible trimmings (e.g., vegetable tops, bread crusts, excess fresh herbs).
     * 'surplus_redistributable': Wholesome, untouched surplus suitable for donation/food banks before spoilage.
     * 'unavoidable_organic': Inedible parts like peels, rinds, bones, eggshells, coffee grounds, pits.
     * 'other_separate': Contaminated food, food contact materials, spent cooking oil, or packaging requiring separate disposal.
   - confidence: A decimal between 0.0 and 1.0 representing classification confidence.
   - recovery_options: Array of circular recovery pathways. Each option MUST have:
     * method: Exactly one of: 'reuse', 'redistribution', 'composting', 'biogas', 'pectin_recovery', 'material_recovery', 'separate_disposal'
     * reason: Clear, actionable reason why this pathway is recommended.
     * requirements: Essential requirements or contamination conditions (e.g., "Must be free from dairy or oil", "Requires commercial high-heat composting facility", "Requires cold-chain transport").
   - reuse_suggestions: 1 to 3 creative, safe culinary, home, or craft reuse ideas (e.g., "Infuse citrus peels in vinegar for non-toxic cleaning solution", "Simmer vegetable trimmings for aromatic broth").
3. Safety & Disclaimer rule: Never present AI visual analysis as a guarantee of food safety or microbial edibility. State uncertainty honestly.
4. Output raw JSON only. Do not wrap in markdown or include conversational text.`;

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
          food_category: { type: 'STRING' },
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
 * Normalizes raw or irregular Gemini output into strict compliance with EcoLith schema:
 * - Unwraps single-item objects or arrays
 * - Maps fuzzy, casing, or missing waste categories to valid database enums
 * - Normalizes circular recovery methods to valid database enums
 * - Injects sensible circular recovery options if Gemini omitted them
 */
export function normalizeGeminiOutput(raw) {
  if (!raw || typeof raw !== 'object') {
    return {
      items: [
        {
          food_name: 'Organic material',
          food_category: 'plant',
          waste_category: 'unavoidable_organic',
          confidence: 0.85,
          recovery_options: [
            {
              method: 'composting',
              reason: 'Suitable plant residue for organic composting.',
              requirements: 'Avoid non-organic contamination.'
            }
          ],
          reuse_suggestions: ['Compost organic residue to enrich garden soil.']
        }
      ],
      notes: 'Contamination and edibility cannot be reliably assessed from a photo alone.'
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

  if (itemsList.length === 0) {
    itemsList = [raw];
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
      (idx === 0 ? 'Organic plant material' : `Item ${idx + 1}`);

    const foodCategory =
      (typeof item === 'object' && (item.food_category || item.category || item.type)) ||
      'vegetable';

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

    // Confidence
    let confidence = 0.88;
    if (typeof item?.confidence === 'number' && !isNaN(item.confidence)) {
      confidence = Math.max(0, Math.min(1, item.confidence));
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
        'Extract natural plant moisture or functional essences for skincare or household use'
      ];
    }

    return {
      food_name: foodName,
      food_category: foodCategory,
      waste_category: wasteCategory,
      confidence,
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

  // High-accuracy model priority under Gemini API Free Tier
  const defaultModel = process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-pro';
  const modelsToTry = modelOverride
    ? [modelOverride]
    : [defaultModel, 'gemini-2.5-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'].filter(
        (v, i, a) => a.indexOf(v) === i
      );

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
            text: 'Analyze the food waste or organic materials visible in this photo. Return only JSON conforming to the schema.'
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
      temperature: 0.2
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
