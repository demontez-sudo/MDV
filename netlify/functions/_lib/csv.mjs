export function parseCsv(text,{maxRows=5000}={}){
  const rows=[];let row=[],field='',quoted=false;const src=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<src.length;i++){
    const ch=src[i];
    if(quoted){if(ch==='"'&&src[i+1]==='"'){field+='"';i++;}else if(ch==='"')quoted=false;else field+=ch;}
    else if(ch==='"')quoted=true;
    else if(ch===','){row.push(field);field='';}
    else if(ch==='\n'){row.push(field);rows.push(row);row=[];field='';if(rows.length>maxRows+1)throw Object.assign(new Error(`CSV exceeds ${maxRows} data rows`),{statusCode:413});}
    else if(ch!=='\r')field+=ch;
  }
  if(field.length||row.length){row.push(field);rows.push(row);}
  if(quoted)throw Object.assign(new Error('CSV contains an unterminated quoted field'),{statusCode:400});
  if(!rows.length)return {headers:[],records:[]};
  const headers=rows[0].map((h,i)=>String(h||`column_${i+1}`).trim());
  const records=rows.slice(1).filter(r=>r.some(v=>String(v||'').trim())).map((r,idx)=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
  return {headers,records};
}

export function normalizeKey(s){return String(s||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'')}
export function mapped(record,mapping,key,...fallbacks){
  const candidates=[mapping?.[key],key,...fallbacks].filter(Boolean);const entries=new Map(Object.entries(record).map(([k,v])=>[normalizeKey(k),v]));
  for(const c of candidates){const v=entries.get(normalizeKey(c));if(v!==undefined&&String(v).trim()!=='')return String(v).trim();}return null;
}
export function splitName(name){const p=String(name||'').trim().split(/\s+/).filter(Boolean);return {first_name:p.shift()||'',last_name:p.join(' ')||null};}
