import { json, adminClient, serverKeyInfo } from './_lib/auth.mjs';
import { emailDeliveryStatus } from './_lib/email.mjs';

const PROD_PROJECT_REF = 'mogyngdhmzbjmcdqeoxu';
const RELEASE = '16.9.91';

export const handler = async (event) => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Method not allowed' });
  try {
    const admin = adminClient();
    const { data, error } = await admin
      .from('organizations')
      .select('id,slug,status')
      .eq('slug', 'maison-de-veux')
      .limit(1);
    if (error || !data?.[0]) {
      return json(503, {
        ok: false,
        service: 'VEUX DESK',
        release: RELEASE,
        supabase_project: PROD_PROJECT_REF,
        service_role_valid: false,
        organization_ready: false,
        email_delivery: emailDeliveryStatus(),
        server_key: (() => { const k = serverKeyInfo(); return { present: !!k.value, source: k.name, format: k.format, had_outer_whitespace: k.had_outer_whitespace, had_wrapping_quotes: k.had_wrapping_quotes }; })(),
        time: new Date().toISOString()
      });
    }
    return json(200, {
      ok: true,
      service: 'VEUX DESK',
      release: RELEASE,
      supabase_project: PROD_PROJECT_REF,
      service_role_valid: true,
      organization_ready: data[0].status === 'active',
      email_delivery: emailDeliveryStatus(),
      server_key: (() => { const k = serverKeyInfo(); return { present: !!k.value, source: k.name, format: k.format, had_outer_whitespace: k.had_outer_whitespace, had_wrapping_quotes: k.had_wrapping_quotes }; })(),
      organization: data[0].slug,
      time: new Date().toISOString()
    });
  } catch (_error) {
    return json(503, {
      ok: false,
      service: 'VEUX DESK',
      release: RELEASE,
      supabase_project: PROD_PROJECT_REF,
      service_role_valid: false,
      organization_ready: false,
      email_delivery: emailDeliveryStatus(),
      server_key: (() => { const k = serverKeyInfo(); return { present: !!k.value, source: k.name, format: k.format, had_outer_whitespace: k.had_outer_whitespace, had_wrapping_quotes: k.had_wrapping_quotes }; })(),
      time: new Date().toISOString()
    });
  }
};
