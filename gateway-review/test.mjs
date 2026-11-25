import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {makeWorker} from './worker.mjs';
const NOW=1795640000;
const payload=()=>({type:'event_callback',team_id:'T_TEST',api_app_id:'A_TEST',event_id:'EvOne',event:{type:'message',channel_type:'channel',channel:'C_TEST',user:'U_TEST',ts:'1795640000.000001',text:'gateway investigate test'}});
function harness(send){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(readFileSync(new URL('./schema.sql',import.meta.url),'utf8'));
 const DB={prepare(sql){const query=(...args)=>({async run(){return {meta:{changes:sqlite.prepare(sql).run(...args).changes}};},async all(){return {results:sqlite.prepare(sql).all(...args)};}});return {...query(),bind:query};}};
 const calls=[]; const env={DB,SLACK_SIGNING_SECRET:'synthetic-secret',SLACK_BOT_TOKEN:'synthetic-token',SLACK_TEAM_ID:'T_TEST',SLACK_APP_ID:'A_TEST',SLACK_CHANNEL_ID:'C_TEST',SLACK_OWNER_ID:'U_TEST',GATEWAY_ENABLED:'true'};
 const worker=makeWorker({clock:()=>NOW,send:async(url,opts)=>{calls.push(JSON.parse(opts.body));assert.equal(url,'https://slack.com/api/chat.postMessage');return send?send():Response.json({ok:true,channel:'C_TEST',ts:'1795640001.000001'});}});
 async function run(p=payload(),{ts=NOW,bad=false,path='/slack/events',drop=false}={}){const body=JSON.stringify(p);const sig=createHmac('sha256',env.SLACK_SIGNING_SECRET).update(`v0:${ts}:${body}`).digest('hex');const jobs=[];const r=await worker.fetch(new Request('https://example.invalid'+path,{method:'POST',body,headers:{'x-slack-request-timestamp':String(ts),'x-slack-signature':'v0='+(bad?'0'.repeat(64):sig)}}),env,{waitUntil(p){if(!drop)jobs.push(p)}});await Promise.all(jobs);return r;}
 async function tick(){const jobs=[];await worker.scheduled({},env,{waitUntil(p){jobs.push(p)}});await Promise.all(jobs);}
 return {run,tick,sqlite,env,calls,rows:()=>sqlite.prepare('SELECT * FROM command_inbox').all()};
}
test('record and thread receipt; event retry suppressed',async()=>{const h=harness();assert.equal((await h.run()).status,200);await h.run();assert.equal(h.calls.length,1);assert.equal(h.calls[0].thread_ts,payload().event.ts);assert.equal(h.rows()[0].receipt_state,'sent');assert.match(h.calls[0].text,/Awaiting manual review/);});
test('different event id same message suppressed',async()=>{const h=harness();await h.run();await h.run({...payload(),event_id:'EvTwo'});assert.equal(h.calls.length,1);});
test('invalid signature and stale timestamp',async()=>{const h=harness();assert.equal((await h.run(payload(),{bad:true})).status,401);assert.equal((await h.run(payload(),{ts:NOW-301})).status,401);assert.equal(h.rows().length,0);});
test('signed challenge works while disabled',async()=>{const h=harness();h.env.GATEWAY_ENABLED='false';const r=await h.run({type:'url_verification',challenge:'test-challenge'});assert.equal(await r.text(),'test-challenge');assert.equal((await h.run()).status,503);});
test('wrong workspace/app/user/channel, bots, threads, edits and unprefixed ignored',async()=>{const h=harness();for(const fields of [{user:'U_OTHER'},{channel:'C_OTHER'},{bot_id:'B_TEST'},{thread_ts:'1795640000.000002'},{subtype:'message_changed'},{text:'ChatGPT Operations: report'},{text:'ordinary text'}]){const p=payload();Object.assign(p.event,fields);assert.equal((await h.run(p)).status,200);}await h.run({...payload(),team_id:'T_OTHER'});await h.run({...payload(),api_app_id:'A_OTHER'});assert.equal(h.rows().length,0);});
test('ambiguous external write not retried',async()=>{const h=harness(()=>{throw new Error('timeout')});await h.run();await h.run();assert.equal(h.rows()[0].receipt_state,'uncertain');assert.equal(h.calls.length,1);});
test('Slack rejection marked uncertain',async()=>{const h=harness(()=>Response.json({ok:false,error:'invalid_auth'}));await h.run();assert.equal(h.rows()[0].receipt_state,'uncertain');});
test('status is truthful and help available',async()=>{const h=harness();let p=payload();p.event.text='gateway status';await h.run(p);assert.match(h.calls[0].text,/AI execution not connected/);p=payload();p.event_id='EvTwo';p.event.ts='1795640000.000002';p.event.text='gateway help';await h.run(p);assert.match(h.calls[1].text,/manual review/);});
test('oversize body rejected and unrelated route closed',async()=>{const h=harness();assert.equal((await h.run({...payload(),padding:'a'.repeat(33000)})).status,413);assert.equal((await h.run(payload(),{path:'/other'})).status,404);});

function seed(h,state,age=300,command='investigate test'){
 h.sqlite.prepare('INSERT INTO command_inbox(event_id,channel,thread_ts,command,received_at,updated_at,receipt_state) VALUES(?,?,?,?,?,?,?)').run('EvSeed','C_TEST','1795640000.000003',command,NOW-age,NOW-age,state);
}
test('scheduled recovery processes durable unclaimed pending command once',async()=>{const h=harness();seed(h,'pending');await h.tick();await h.tick();assert.equal(h.calls.length,1);assert.equal(h.rows()[0].receipt_state,'sent');assert.equal(h.rows()[0].attempts,1);});
test('stale claimed command quarantined, never replayed',async()=>{const h=harness();seed(h,'sending');await h.tick();await h.tick();assert.equal(h.rows()[0].receipt_state,'uncertain');assert.equal(h.calls.length,0);});
test('fresh in-flight command is not quarantined or replayed',async()=>{const h=harness();seed(h,'sending',30);await h.tick();assert.equal(h.rows()[0].receipt_state,'sending');assert.equal(h.calls.length,0);});
test('disabled recovery performs no writes or sends',async()=>{const h=harness();seed(h,'pending');h.env.GATEWAY_ENABLED='false';await h.tick();assert.equal(h.rows()[0].receipt_state,'pending');assert.equal(h.calls.length,0);});
test('natural language works in natural mode; legacy relay messages ignored',async()=>{const h=harness();h.env.GATEWAY_MODE='natural';const p=payload();p.event.text='ChatGPT Operations: report';await h.run(p);assert.equal(h.rows().length,0);p.event.text='Please research cloud compute';await h.run(p);assert.equal(h.rows()[0].command,p.event.text);assert.match(h.calls[0].text,/Awaiting manual review/);});
test('utility retention preserves dedupe IDs and unresolved requests',async()=>{const h=harness();seed(h,'sent',8*86400,'status');await h.tick();assert.equal(h.rows()[0].command,'[redacted utility command]');assert.equal(h.rows()[0].event_id,'EvSeed');});
test('old substantive assignment not silently deleted',async()=>{const h=harness();seed(h,'sent',8*86400);await h.tick();assert.equal(h.rows()[0].command,'investigate test');});
test('concurrent recovery claims only once',async()=>{const h=harness();seed(h,'pending');await Promise.all([h.tick(),h.tick()]);assert.equal(h.calls.length,1);assert.equal(h.rows()[0].attempts,1);});
