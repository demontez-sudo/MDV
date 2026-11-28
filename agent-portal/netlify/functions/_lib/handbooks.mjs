/* Private handbooks a model can open from their Gameplan. Each one names the model it belongs to; nobody else is shown it or can fetch it.
   To add one: put its HTML in a _lib/handbook-<name>.mjs file (export const HTML) and list it here. */
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const HANDBOOKS = [
  {
    id: 'posing-handbook',
    title: 'Posing Handbook',
    blurb: 'Your private coaching manual for Paris Men\u2019s FW27: stance, face, hands, the pose library, movement, shoot day and your four-week practice program.',
    models: ['samuel yusuf'],
    load: async () => (await import('./handbook-samuel-yusuf.mjs')).HTML
  }
];

export const handbooksFor = modelName => HANDBOOKS.filter(h => h.models.includes(norm(modelName)));
export const publicHandbook = h => ({ id: h.id, title: h.title, blurb: h.blurb });
