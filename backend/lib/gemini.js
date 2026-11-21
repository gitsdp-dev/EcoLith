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
  const model = modelOverride || process.env.DEFAULT_GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;

  // Strip data: prefix if accidentally passed
  const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  const payload = {
    contents: [
      {
        parts: [
          {
            text: SYSTEM_INSTRUCTION
          },
          {
            text: 'Analyze the food waste or organic materials visible in this photo. Return only JSON.'
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
      temperature: 0.2
    }
  };

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(payload)
    });
  } catch {
    const error = new Error('Failed to communicate with Google Gemini API.');
    error.code = 'GEMINI_UNAVAILABLE';
    error.status = 503;
    throw error;
  }

  // Handle HTTP error responses
  if (!response.ok) {
    const status = response.status;
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

  // Validate with Zod schema
  const validationResult = geminiAnalysisSchema.safeParse(parsedJson);
  if (!validationResult.success) {
    // If array was returned directly without { items: [...] }
    if (Array.isArray(parsedJson)) {
      const fallbackResult = geminiAnalysisSchema.safeParse({ items: parsedJson });
      if (fallbackResult.success) {
        return fallbackResult.data;
      }
    }

    console.warn('Gemini schema validation issue:', validationResult.error.format());
    const err = new Error(
      'AI output failed schema validation: ' + validationResult.error.errors[0]?.message
    );
    err.code = 'INVALID_AI_SCHEMA';
    err.status = 502;
    throw err;
  }

  return validationResult.data;
}
