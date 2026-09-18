export async function getOrganizationCapacity(admin, organizationId) {
  const [{ data: sub, error: subError }, { count: staffCount, error: staffError }, { count: modelCount, error: modelError }, { count: marketCount, error: marketError }] = await Promise.all([
    admin.from('organization_subscriptions').select('id,status,plan_id,seat_quantity,subscription_plans(id,key,name,included_staff,included_models,included_markets)').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organization_members').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('member_type','staff').in('status',['invited','active']),
    admin.from('models').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('active', true),
    admin.from('markets').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('active', true)
  ]);
  if (subError) throw subError; if (staffError) throw staffError; if (modelError) throw modelError; if (marketError) throw marketError;

  const plan = sub?.subscription_plans || null;
  const { data: overrides, error: overrideError } = await admin.from('organization_entitlement_overrides').select('feature_key,enabled,limit_value,expires_at').eq('organization_id', organizationId);
  if (overrideError) throw overrideError;
  const activeOverrides = new Map((overrides || []).filter(o => !o.expires_at || Date.parse(o.expires_at) > Date.now()).map(o => [o.feature_key,o]));
  const overrideLimit = key => activeOverrides.get(key)?.limit_value ?? null;

  return {
    subscription: sub || null,
    plan,
    staff: { used: staffCount || 0, limit: overrideLimit('staff_seats') ?? sub?.seat_quantity ?? plan?.included_staff ?? null },
    models: { used: modelCount || 0, limit: overrideLimit('model_capacity') ?? plan?.included_models ?? null },
    markets: { used: marketCount || 0, limit: overrideLimit('market_capacity') ?? plan?.included_markets ?? null }
  };
}

export function assertCapacity(capacity, resource, additional = 1) {
  const bucket = capacity?.[resource];
  if (!bucket || bucket.limit == null) return;
  if ((Number(bucket.used) + Number(additional)) > Number(bucket.limit)) {
    const err = new Error(`${resource} capacity reached for the current VEUX plan`);
    err.statusCode = 409;
    err.code = 'PLAN_CAPACITY_REACHED';
    err.capacity = bucket;
    throw err;
  }
}
