import { handler as authority } from './model-password-authority.mjs';
export async function handler(event){let body={};try{body=event.body?JSON.parse(event.body):{}}catch{};return authority({...event,body:JSON.stringify({...body,action:'change_current',current_password:body.current_password||body.password||'',new_password:body.new_password||body.newPassword||''})});}
