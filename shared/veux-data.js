/**
 * VEUX shared data adapter.
 *
 * This module is intentionally dependency-free: Netlify Functions bundle it
 * directly from the repository root. Keep the exported createVeuxData contract
 * stable because agent-bootstrap.mjs consumes it during portal bootstrap.
 */

function assertResult(result, label) {
  if (result?.error) {
    const error = new Error(`${label}: ${result.error.message || 'query failed'}`);
    error.cause = result.error;
    throw error;
  }
  return result?.data || [];
}

function manyBy(rows, key) {
  const out = new Map();
  for (const row of rows || []) {
    const value = row?.[key];
    if (value == null) continue;
    if (!out.has(value)) out.set(value, []);
    out.get(value).push(row);
  }
  return out;
}

function oneBy(rows, key) {
  return new Map((rows || []).filter(Boolean).map((row) => [row?.[key], row]));
}

async function loadRoster(client, organizationId, options = {}) {
  let modelsQuery = client
    .from('models')
    .select('*')
    .eq('organization_id', organizationId)
    .order('display_name', { ascending: true });

  if (options.active === true || options.active === false) {
    modelsQuery = modelsQuery.eq('active', options.active);
  }

  const models = assertResult(await modelsQuery, 'models');
  const modelIds = models.map((row) => row.id).filter(Boolean);
  if (!modelIds.length) return { roster: [] };

  const [measurementsRes, mediaRes, marketsRes, divisionsRes] = await Promise.all([
    client.from('model_measurements').select('*').eq('organization_id', organizationId).in('model_id', modelIds),
    client.from('model_media').select('*').eq('organization_id', organizationId).in('model_id', modelIds).order('sort_order', { ascending: true }),
    client.from('model_market_assignments')
      .select('model_id,is_primary,status,market_id,markets!model_market_market_same_org_fk(id,name,code,city)')
      .eq('organization_id', organizationId)
      .in('model_id', modelIds),
    client.from('model_division_assignments')
      .select('model_id,is_primary,division_id,board_id,divisions!model_division_division_same_org_fk(id,name)')
      .eq('organization_id', organizationId)
      .in('model_id', modelIds)
  ]);

  const measurements = assertResult(measurementsRes, 'model_measurements');
  const media = assertResult(mediaRes, 'model_media');
  const markets = assertResult(marketsRes, 'model_market_assignments');
  const divisions = assertResult(divisionsRes, 'model_division_assignments');

  const boardIds = [...new Set(divisions.map((row) => row.board_id).filter(Boolean))];
  let boards = [];
  if (boardIds.length) {
    boards = assertResult(
      await client.from('boards').select('id,name,market_id,division_id,sort_order').eq('organization_id', organizationId).in('id', boardIds),
      'boards'
    );
  }

  const boardMarketIds = [...new Set(boards.map((row) => row.market_id).filter(Boolean))];
  let boardMarkets = [];
  if (boardMarketIds.length) {
    boardMarkets = assertResult(
      await client.from('markets').select('id,name,code,city,sort_order').eq('organization_id', organizationId).in('id', boardMarketIds),
      'markets'
    );
  }

  const marketById = oneBy(boardMarkets, 'id');
  const boardById = new Map(
    boards.map((board) => [
      board.id,
      { ...board, markets: marketById.get(board.market_id) || null }
    ])
  );
  const enrichedDivisions = divisions.map((row) => ({
    ...row,
    boards: boardById.get(row.board_id) || null
  }));

  const measurementByModel = oneBy(measurements, 'model_id');
  const mediaByModel = manyBy(media, 'model_id');
  const marketsByModel = manyBy(markets, 'model_id');
  const divisionsByModel = manyBy(enrichedDivisions, 'model_id');

  return {
    roster: models.map((model) => ({
      ...model,
      measurement: measurementByModel.get(model.id) || null,
      media: mediaByModel.get(model.id) || [],
      markets: marketsByModel.get(model.id) || [],
      market_assignments: marketsByModel.get(model.id) || [],
      divisions: divisionsByModel.get(model.id) || [],
      division_assignments: divisionsByModel.get(model.id) || []
    }))
  };
}

async function rows(client, table, organizationId, orderColumn, options = {}) {
  let query = client.from(table).select('*').eq('organization_id', organizationId);
  if (orderColumn) {
    query = query.order(orderColumn, {
      ascending: options.ascending !== false,
      nullsFirst: options.nullsFirst === true
    });
  }
  if (options.limit) query = query.limit(options.limit);
  return assertResult(await query, table);
}

/**
 * Create the organization-scoped data API used by the Agent bootstrap.
 */
export function createVeuxData(client, organizationId) {
  if (!client) throw new Error('createVeuxData requires a Supabase client');
  if (!organizationId) throw new Error('createVeuxData requires an organization id');

  return {
    roster: (options = {}) => loadRoster(client, organizationId, options),
    companies: () => rows(client, 'companies', organizationId, 'name', { limit: 1000 }),
    contacts: () => rows(client, 'contacts', organizationId, 'display_name', { limit: 1500 }),
    calendar: async () => ({
      events: await rows(client, 'events', organizationId, 'starts_at', { limit: 1500 })
    }),
    bookings: () => rows(client, 'bookings', organizationId, 'starts_at', { limit: 1500 }),
    castings: () => rows(client, 'castings', organizationId, 'starts_at', { limit: 1500 }),
    tasks: () => rows(client, 'tasks', organizationId, 'due_at', { limit: 1500 })
  };
}
