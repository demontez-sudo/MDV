# CAVYRE 16.15.08 — Calendar Runtime Authority

Crash follow-up to 16.15.07.

## Root cause found
The repaired Calendar engine `cavyre-calendar-engine-16.15.06.js` existed in the package but was not referenced by the active Agent Portal HTML. Historical Calendar renderers inside the consolidated 16.11.48 runtime therefore remained capable of owning Calendar behavior.

## Corrections
- Active Agent Portal now loads `cavyre-calendar-engine-16.15.06.js` before the bounded Calendar/Model360 helper.
- Quarantined legacy Calendar System Reset 16.11.15 and Live Calendar DOM Authority 16.11.16 from consolidated runtime.
- Quarantined legacy Month Split 16.11.26/27 and Calendar Geometry Runtime 16.11.40.
- Quarantined historical deployment/certification observer modules 16.11.19–23 that were not production feature authorities.
- Removed duplicate Model360 Development route-lock script; 16.15.07 bounded Model360 authority remains owner.
- Removed 16.15.05 operating-order observer script from active boot.
- Service-worker cache advanced to 16.15.08.

No Netlify deployment performed.
