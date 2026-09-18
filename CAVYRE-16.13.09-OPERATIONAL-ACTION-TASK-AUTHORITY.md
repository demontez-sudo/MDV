# CAVYRE 16.13.09 — Operational Action / Task Authority

## Objective
Continue the connected operating-system architecture by making Tasks a first-class projection of the Model Operating Graph and by turning verified operational intelligence into reviewable actions.

## What changed
- Adds `cavyre-operational-action-authority-16.13.09.js` to both Agent runtime mirrors.
- Reads the existing model graph and Relationship Authority; it creates no duplicate Season, Booking, Travel, Visa, Casting, Availability or Calendar records.
- Adds open model Tasks to the shared operational timeline.
- Derives proposed actions from verified conflicts, Visa attention and active availability blocks.
- Deduplicates proposals against existing open Tasks.
- Proposed actions are **review-only** until the agent approves them.
- Approved action Tasks write through the existing canonical `/api/agent/tasks/v11` endpoint and require `verified:true` before CAVYRE treats the write as successful.
- The existing Model Operating Web invalidation then refreshes the connected model context after the verified write.
- Calendar Connected Operations now shows open-task count and, when appropriate, an explicit `Create priority task` control.
- Vera context now receives Tasks, proposed actions and the task-enriched timeline from the same shared authority.

## Safety / authority rule
CAVYRE may infer that an operational action is needed, but it does not silently create production Tasks from inference. Agent approval is required before a proposed action is written.

## Architecture
Authoritative records → Model Operating Graph → Relationship Authority → Operational Action Authority → Season / Calendar / Vera / Tasks.

## Deployment
Local build only. No Netlify deployment performed.
