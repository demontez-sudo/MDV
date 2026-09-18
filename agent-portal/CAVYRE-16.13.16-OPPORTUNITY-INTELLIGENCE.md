# CAVYRE 16.13.16 — Opportunity Intelligence

## Objective
Turn CAVYRE from a reactive model/client database into a proactive agency opportunity layer that answers: **who should be pitched to which client, in which market, and when?**

## New authority
### `agent-opportunity-intelligence-v1.mjs`
Read-only intelligence endpoint:
- `/api/agent/opportunities/v1`
- `/admin/api/agent/opportunities/v1`

The endpoint reads existing authoritative records only. It does **not** create a second opportunity database.

### Signals connected
- current/upcoming castings
- Season / Fashion Week show windows
- client relationship history
- verified client-fit history
- model availability
- confirmed booking conflicts
- active options
- travel / upcoming market movement
- visa and work authorization records
- market assignments
- package engagement

## Opportunity classes
1. **Active Casting** — a live casting in the planning horizon.
2. **Upcoming Show** — a Season/show date that creates a model preparation or pitching window.
3. **Relationship Window** — a verified client pattern overlaps an upcoming Season/market window. This is explicitly advisory and is not represented as a client job.
4. **Market Arrival** — a model has upcoming movement into a market and verified historical fit with a client, creating a targeted outreach window.

## Ranking
Each opportunity receives a priority score using:
- time urgency
- relationship strength
- current model strength/readiness
- signal/source confidence

Models are ranked per opportunity using:
- live operational readiness
- availability
- booking/casting conflict checks
- option position
- market presence / movement
- visa or work-authorization evidence
- verified client-fit history

Hard availability or booking conflicts cap a model's opportunity score.

## Agent interface
New **OPPORTUNITY COMMAND** overlay provides:
- total opportunity count
- urgent opportunities
- active castings
- show / market-arrival windows
- client count
- number of opportunities with at least one strong model
- filters for Castings, Shows, Market Arrivals, Relationship Windows, and Urgent
- top model recommendations per opportunity
- priority score and why the opportunity matters now
- direct Client Command handoff
- Vera handoff
- active Opportunity Context for downstream intelligence

The command is injected into:
- Companies / Clients
- Client detail navigation
- Season / Season Management

## Vera
The latest opportunity payload is exposed as:
- `window.__CAVYRE_OPPORTUNITY_CONTEXT__`
- `CAVYRE_VERA_SMART.state.opportunity_intelligence`

A selected opportunity is exposed as:
- `window.__CAVYRE_ACTIVE_OPPORTUNITY__`
- `CAVYRE_VERA_SMART.state.active_opportunity`

## Safety / authority rules
- Read-only intelligence.
- No inferred opportunity is written to Supabase.
- Relationship and market-arrival windows are advisory.
- Protected traits remain excluded from Client Fit Intelligence.
- Existing bookings, castings, Season, travel, visa, client and package records remain authoritative.
- Agent judgment remains final.
- No Netlify deployment was performed.
