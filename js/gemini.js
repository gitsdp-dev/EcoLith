import { CONFIG } from './config.js';
import { supabase } from './supabase.js';

/**
 * Frontend wrapper that calls the EcoLith backend AI analysis endpoint.
 * EcoLith adheres to BYOK (Bring Your Own Key): the client NEVER calls Google Gemini directly
 * and never exposes or handles API keys in scan requests.
 *
 * @param {string} base64Image - Base64 encoded image string (with or without data: URL prefix)
 * @param {string} [mimeType='image/jpeg'] - Image mime type
 * @returns {Promise<{ items: Array<object>, notes: string }>} Analysis result
 */
export async function analyzeFoodImage(base64Image, mimeType = 'image/jpeg') {
  // Obtain fresh Supabase access token
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    const error = new Error('You must be signed in to perform food waste analysis.');
    error.code = 'UNAUTHORIZED';
    throw error;
  }

  // Ensure clean base64 payload without data URI prefix
  const cleanBase64 = base64Image.replace(/^data:image\/[a-zA-Z]+;base64,/, '');

  let response;
  try {
    response = await fetch(`${CONFIG.API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        image: cleanBase64,
        mimeType
      })
    });
  } catch {
    const error = new Error(
      'Unable to reach the EcoLith analysis service. Please check your network connection.'
    );
    error.code = 'NETWORK_ERROR';
    throw error;
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.message ||
        (response.status === 404
          ? 'EcoLith analysis API route not found (404). Please ensure the backend is running.'
          : `Analysis failed with status ${response.status}`)
    );
    error.code = data.code || 'ANALYSIS_ERROR';
    error.status = response.status;
    throw error;
  }

  return data;
}
