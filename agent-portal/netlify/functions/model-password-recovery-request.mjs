import { handler as authority } from './model-password-authority.mjs';
export async function handler(event){let body={};try{body=event.body?JSON.parse(event.body):{}}catch{};return authority({...event,body:JSON.stringify({...body,action:'request_recovery'})});}
