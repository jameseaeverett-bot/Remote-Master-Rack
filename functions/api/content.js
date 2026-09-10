import { contentJson, listPublishedContent } from '../_lib/content.js';

export async function onRequestGet({ env }) {
  try {
    if (!env.CONTENT_DB) return contentJson({ error: 'Published content is temporarily unavailable.' }, 503, true);
    return contentJson(await listPublishedContent(env.CONTENT_DB), 200, true);
  } catch (error) {
    console.error('RMR public content lookup failed.', { type: error?.name || 'Error' });
    return contentJson({ error: 'Published content is temporarily unavailable.' }, 503, true);
  }
}

export function onRequestOptions() {
  return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Authorization, Content-Type', Vary: 'Origin' } });
}
