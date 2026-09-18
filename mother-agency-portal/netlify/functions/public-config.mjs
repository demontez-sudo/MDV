import { json, errorResponse } from './_lib/auth.mjs';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const url = 'https://mogyngdhmzbjmcdqeoxu.supabase.co';
    const publishableKey = 'sb_publishable_6fTsGxRRIDzjXaoUrT0XOg_yZWu21ql';
    return json(200, {
      supabase_url: url,
      supabase_publishable_key: publishableKey,
      environment: 'mogy-production-locked'
    }, { 'Cache-Control': 'public, max-age=300' });
  } catch (error) {
    return errorResponse(error);
  }
};
