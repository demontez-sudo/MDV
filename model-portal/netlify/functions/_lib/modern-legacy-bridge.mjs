export async function toLegacyEvent(req, bodyOverride){
  const u=new URL(req.url);
  const headers={};
  req.headers.forEach((v,k)=>{headers[k]=v;});
  let body='';
  if(bodyOverride!==undefined) body=JSON.stringify(bodyOverride);
  else if(!['GET','HEAD'].includes(req.method)) body=await req.text();
  return {
    httpMethod:req.method,
    headers,
    body,
    isBase64Encoded:false,
    path:u.pathname,
    rawUrl:req.url,
    queryStringParameters:Object.fromEntries(u.searchParams.entries())
  };
}
export function fromLegacyResponse(out){
  const status=Number(out?.statusCode||200);
  const headers=new Headers(out?.headers||{});
  if(!headers.has('content-type'))headers.set('content-type','application/json; charset=utf-8');
  return new Response(out?.body??'',{status,headers});
}
export function parseLegacyBody(out){
  try{return JSON.parse(out?.body||'{}');}catch{return{};}
}
export function jsonResponse(status,payload){
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});
}
