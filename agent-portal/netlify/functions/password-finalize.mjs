import { requireUser, adminClient, parseBody, json, errorResponse } from './_lib/auth.mjs';

const ORG_SLUG = 'maison-de-veux';

export async function handler(event) {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, { Allow: 'POST' });
  try {
    const { user } = await requireUser(event);
    const body = parseBody(event);
    const password = typeof body.password === 'string' ? body.password : '';
    if (password.length < 10) return json(400, { error: 'Use at least 10 characters.' });
    if (Buffer.byteLength(password, 'utf8') > 72) return json(400, { error: 'Password is too long. Use 72 bytes or fewer.' });

    const admin = adminClient();
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .select('id,status')
      .eq('slug', ORG_SLUG)
      .eq('status', 'active')
      .maybeSingle();
    if (orgError) throw orgError;
    if (!org?.id) return json(503, { error: 'Maison de Veux organization is unavailable.' });

    const { data: membership, error: membershipError } = await admin
      .from('organization_members')
      .select('id,status')
      .eq('organization_id', org.id)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    if (membershipError) throw membershipError;
    if (!membership?.id) return json(403, { error: 'Active Agency team access is required.' });

    const { data: updated, error: updateError } = await admin.auth.admin.updateUserById(user.id, { password });
    if (updateError) {
      updateError.statusCode = 400;
      throw updateError;
    }
    if (!updated?.user?.id || updated.user.id !== user.id) return json(500, { error: 'Supabase did not confirm the password update.' });

    return json(200, {
      ok: true,
      password_saved: true,
      supabase_project: 'mogyngdhmzbjmcdqeoxu',
      user_id: user.id,
      email: user.email || updated.user.email || null
    });
  } catch (error) {
    return errorResponse(error);
  }
}
