import { runAutomaticEscalation } from './_lib/portal-escalation.mjs';
export default async ()=>{
  try{const result=await runAutomaticEscalation({limit:800});return Response.json({ok:true,environment:'veux-desk-v16.5',...result});}
  catch(error){console.error('[VEUX 16.5 escalation sweep]',error);return Response.json({ok:false,error:'Escalation sweep failed'},{status:500});}
};
export const config={schedule:'@hourly'};
