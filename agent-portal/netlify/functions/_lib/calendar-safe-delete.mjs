/* "The table or column is not in this database" (undefined table / column / not in the schema cache). */
const NOT_THERE = new Set(['42P01', '42703', 'PGRST200', 'PGRST204', 'PGRST205']);
const notThere = err => NOT_THERE.has(String(err?.code || '').toUpperCase()) || /does not exist|schema cache|could not find (the )?(table|column)/i.test(String(err?.message || ''));
/* optional steps only tidy up related rows. If the table or column they touch does not exist here there is nothing to tidy, so the
   delete carries on; any other failure (a row still referenced, no permission) still stops it, and now says why. */
async function must(result,label,{optional=false}={}){
  const out=await result;
  if(out?.error){
    if(optional&&notThere(out.error)){console.warn('[calendar delete] skipped "'+label+'": '+String(out.error.message||out.error.code||'').slice(0,120));return null;}
    const reason=String(out.error.message||'').replace(/\s+/g,' ').slice(0,160);
    const e=new Error(`Delete blocked while ${label.toLowerCase()}${reason?': '+reason:''}.`);
    e.statusCode=409;
    e.publicMessage=e.message;
    e.code=out.error.code||null;
    e.details=out.error.details||null;
    throw e;
  }
  return out?.data||null;
}

export async function safeDeleteEvent(admin,organizationId,eventId){
  if(!eventId)throw new Error('event_id is required');
  await must(admin.from('availability_blocks').update({source_event_id:null}).eq('organization_id',organizationId).eq('source_event_id',eventId),'Detach event availability',{optional:true});
  await must(admin.from('tasks').update({event_id:null}).eq('organization_id',organizationId).eq('event_id',eventId),'Detach event tasks',{optional:true});
  await must(admin.from('event_members').delete().eq('organization_id',organizationId).eq('event_id',eventId),'Delete event members',{optional:true});
  await must(admin.from('event_models').delete().eq('organization_id',organizationId).eq('event_id',eventId),'Delete event models');
  const deleted=await must(admin.from('events').delete().eq('organization_id',organizationId).eq('id',eventId).select('id').single(),'Delete event');
  if(deleted?.id!==eventId)throw new Error('Event deletion could not be verified');
  return {ok:true,verified:true,event_id:eventId};
}

export async function safeDeleteBooking(admin,organizationId,bookingId){
  if(!bookingId)throw new Error('booking_id is required');
  const linked=await must(admin.from('events').select('id').eq('organization_id',organizationId).eq('booking_id',bookingId),'Load linked booking events')||[];
  for(const ev of linked)await safeDeleteEvent(admin,organizationId,ev.id);

  // Preserve operational/history rows that are designed to outlive the booking.
  for(const [table,column] of [
    ['contracts','booking_id'],['crm_activity','booking_id'],['expenses','booking_id'],
    ['invoice_items','booking_id'],['model_ledger_entries','booking_id'],['package_conversions','booking_id'],
    ['partner_ledger_entries','booking_id'],['season_shows','booking_id'],['travel_records','booking_id'],
    ['conversations','booking_id'],['tasks','booking_id']
  ]){
    await must(admin.from(table).update({[column]:null}).eq('organization_id',organizationId).eq(column,bookingId),`Detach ${table}`);
  }

  // Booking-owned relational rows must be removed explicitly because same-org composite FKs are restrictive.
  for(const table of ['booking_models','booking_options','booking_rates','booking_usage_terms','commissions','usage_rights']){
    await must(admin.from(table).delete().eq('organization_id',organizationId).eq('booking_id',bookingId),`Delete ${table}`);
  }

  const deleted=await must(admin.from('bookings').delete().eq('organization_id',organizationId).eq('id',bookingId).select('id').single(),'Delete booking');
  if(deleted?.id!==bookingId)throw new Error('Booking deletion could not be verified');
  return {ok:true,verified:true,booking_id:bookingId};
}

export async function safeDeleteCasting(admin,organizationId,castingId){
  if(!castingId)throw new Error('casting_id is required');
  const linked=await must(admin.from('events').select('id').eq('organization_id',organizationId).eq('casting_id',castingId),'Load linked casting events')||[];
  for(const ev of linked)await safeDeleteEvent(admin,organizationId,ev.id);

  for(const [table,column] of [
    ['bookings','source_casting_id'],['crm_activity','casting_id'],['package_conversions','casting_id'],
    ['season_shows','casting_id'],['conversations','casting_id'],['tasks','casting_id']
  ]){
    await must(admin.from(table).update({[column]:null}).eq('organization_id',organizationId).eq(column,castingId),`Detach ${table}`);
  }

  await must(admin.from('casting_models').delete().eq('organization_id',organizationId).eq('casting_id',castingId),'Delete casting models');
  const deleted=await must(admin.from('castings').delete().eq('organization_id',organizationId).eq('id',castingId).select('id').single(),'Delete casting');
  if(deleted?.id!==castingId)throw new Error('Casting deletion could not be verified');
  return {ok:true,verified:true,casting_id:castingId};
}
