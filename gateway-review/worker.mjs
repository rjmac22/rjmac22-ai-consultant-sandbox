const enc = new TextEncoder();
const MAX_BODY = 32768;
const MAX_COMMAND = 2000;
const response = (status, text = '') => new Response(text, {status});
const enabled = env => env.GATEWAY_ENABLED === 'true';

async function verify(request, bytes, secret, now) {
  const ts = request.headers.get('x-slack-request-timestamp') || '';
  const sig = request.headers.get('x-slack-signature') || '';
  if (!secret || !/^\d{10}$/.test(ts) || !/^v0=[0-9a-f]{64}$/.test(sig) || Math.abs(now - Number(ts)) > 300) return false;
  const prefix = enc.encode(`v0:${ts}:`);
  const message = new Uint8Array(prefix.length + bytes.length);
  message.set(prefix); message.set(bytes, prefix.length);
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['verify']);
  const signature = Uint8Array.from(sig.slice(3).match(/../g), x => parseInt(x,16));
  return crypto.subtle.verify('HMAC', key, signature, message);
}

async function readBounded(request) {
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const parts=[]; let size=0;
  try {
    while (true) {
      const {done,value}=await reader.read(); if(done) break;
      size+=value.length;
      if(size>MAX_BODY){await reader.cancel(); return null;}
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes=new Uint8Array(size); let offset=0;
  for(const part of parts){bytes.set(part,offset); offset+=part.length;}
  return bytes;
}

function getCommand(payload,env){
  const e=payload.event;
  if(payload.type!=='event_callback' || payload.team_id!==env.SLACK_TEAM_ID || payload.api_app_id!==env.SLACK_APP_ID || !e || e.type!=='message' || e.channel!==env.SLACK_CHANNEL_ID || e.user!==env.SLACK_OWNER_ID || e.subtype || e.bot_id || e.app_id || e.thread_ts || e.hidden || e.channel_type!=='channel') return null;
  if(!/^Ev[A-Za-z0-9]{1,100}$/.test(payload.event_id || '') || !/^\d{10}\.\d{6}$/.test(e.ts || '') || typeof e.text!=='string') return null;
  // Explicit pilot prefix avoids interfering with the existing hourly relay.
  const m=e.text.match(/^gateway(?:\s+([\s\S]*))?$/i);
  if(!m) return null;
  const command=(m[1]||'help').trim()||'help';
  if(command.length>MAX_COMMAND) return null;
  return {id:payload.event_id,channel:e.channel,ts:e.ts,command};
}

async function deliver(env,item,send){
  if(!enabled(env) || !env.SLACK_BOT_TOKEN) return;
  const claim=await env.DB.prepare("UPDATE command_inbox SET receipt_state='sending' WHERE event_id=? AND receipt_state='pending'").bind(item.id).run();
  if(claim.meta.changes!==1) return;
  let text;
  try {
    const verb=item.command.toLowerCase();
    if(verb==='help') text='Command Gateway: use gateway help, gateway status, or gateway <research request>. Requests are recorded for manual review; no AI execution is connected yet.';
    else if(verb==='status') {
      const counts=await env.DB.prepare("SELECT receipt_state, COUNT(*) AS n FROM command_inbox GROUP BY receipt_state").all();
      const summary=counts.results.map(r=>`${r.receipt_state}: ${r.n}`).join(', ');
      text=`Command Gateway: inbox accessible. Receipt counts (including this command): ${summary}. AI execution not connected; pending/sending/uncertain receipts require review.`;
    } else text=`Command Gateway: request recorded (${item.id}). Awaiting manual review; no officer has accepted it and no external action has been taken.`;
    if(!enabled(env)) {await env.DB.prepare("UPDATE command_inbox SET receipt_state='pending' WHERE event_id=? AND receipt_state='sending'").bind(item.id).run(); return;}
    const result=await send('https://slack.com/api/chat.postMessage', {method:'POST',headers:{authorization:`Bearer ${env.SLACK_BOT_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({channel:item.channel,thread_ts:item.ts,text,unfurl_links:false,unfurl_media:false}),signal:AbortSignal.timeout(8000),redirect:'error'});
    const body=await result.json();
    if(!result.ok || body.ok!==true || body.channel!==item.channel || !/^\d{10}\.\d{6}$/.test(body.ts||'')) throw new Error('unverified write');
    await env.DB.prepare("UPDATE command_inbox SET receipt_state='sent', reply_ts=? WHERE event_id=? AND receipt_state='sending'").bind(body.ts,item.id).run();
  } catch {
    // Never retry an uncertain external write automatically; reconcile against Slack first.
    // If even this update fails, the durable 'sending' state is itself an incident marker.
    try {await env.DB.prepare("UPDATE command_inbox SET receipt_state='uncertain' WHERE event_id=? AND receipt_state='sending'").bind(item.id).run();} catch {}
  }
}

export function makeWorker({send=fetch,clock=()=>Math.floor(Date.now()/1000)}={}){
  return {async fetch(request,env,ctx){
    if(new URL(request.url).pathname!=='/slack/events' || request.method!=='POST') return response(404);
    if(!env.SLACK_SIGNING_SECRET || !env.SLACK_TEAM_ID || !env.SLACK_APP_ID || !env.SLACK_CHANNEL_ID || !env.SLACK_OWNER_ID) return response(503);
    try {
      const bytes=await readBounded(request); if(!bytes) return response(413);
      if(!await verify(request,bytes,env.SLACK_SIGNING_SECRET,clock())) return response(401);
      let payload; try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return response(400);}
      if(!payload || typeof payload!=='object') return response(400);
      // Slack URL verification is signed; allow only its challenge, even while disabled.
      if(payload.type==='url_verification') return typeof payload.challenge==='string' && payload.challenge.length<512 ? response(200,payload.challenge) : response(400);
      if(!enabled(env) || !env.SLACK_BOT_TOKEN) return response(503);
      const item=getCommand(payload,env); if(!item) return response(200);
      // Store before HTTP acknowledgement. Primary and channel/thread unique keys dedupe retries.
      const insert=await env.DB.prepare("INSERT OR IGNORE INTO command_inbox (event_id,channel,thread_ts,command,received_at,receipt_state) VALUES (?,?,?,?,?,'pending')").bind(item.id,item.channel,item.ts,item.command,clock()).run();
      if(insert.meta.changes===1) ctx.waitUntil(deliver(env,item,send));
      return response(200);
    } catch {return response(503);}
  }};
}
export default makeWorker();
