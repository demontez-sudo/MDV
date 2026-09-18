# CAVYRE 16.12.76 — Task Form Single Authority

Root cause found:
The old browser prompt was still coming from `veux-agent-v15-extensions-16.8.5.js`,
where `VEUX_V10.newTask()` still contained `prompt('Task title')`.

16.12.75 removed the prompt from a newer extension, but the older 16.8.5 extension
remained active in production. That is why the browser prompt still appeared first.

16.12.76:
- removes the remaining Task Title / Due Date browser prompt from 16.8.5,
- replaces the old full Task CRUD authority with the Quick Task form,
- makes Quick Task the compatibility target for old 161142/161275 calls,
- adds a capture-phase Add Task guard before legacy handlers can execute,
- embeds the full task authority in root and admin HTML to survive asset/load-order issues.

Only one creation experience remains:
ADD TASK → Quick Task form → Create Task.

No Calendar, CRM, Package, Season, or Model Portal behavior changed.
