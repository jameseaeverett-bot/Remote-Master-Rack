import { contentJson, listPublishedContent } from '../_lib/content.js';
import { listPublicProductMediaAssignments } from '../_lib/public-product-media.js';

export async function onRequestGet({ env }) {
  try {
    if (!env.CONTENT_DB) return contentJson({ error: 'Published content is temporarily unavailable.' }, 503, true);
    const content = await listPublishedContent(env.CONTENT_DB);
    let productMedia = [];
    try {
      productMedia = await listPublicProductMediaAssignments(env.CONTENT_DB);
    } catch (error) {
      // CMS V2 media is additive. A failed extension lookup must not remove the
      // established CMS V1 text contract or built-in website fallback content.
      console.error('RMR public product-media lookup failed.', { type: error?.name || 'Error' });
    }
    return contentJson({
      ...content,
      extensions: { cmsV2: { version: 1, productMedia } },
    }, 200, true);
  } catch (error) {
    console.error('RMR public content lookup failed.', { type: error?.name || 'Error' });
    return contentJson({ error: 'Published content is temporarily unavailable.' }, 503, true);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' } });
}