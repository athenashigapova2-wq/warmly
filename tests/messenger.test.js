import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202611110002_messenger.sql',import.meta.url),'utf8'));
for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
async function user(index){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[index]||'']);await db.exec('set role authenticated');}
async function rpc(action,payload={}){return (await db.query('select public.messenger($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;}
let direct,group;
test('profiles, consent, direct chats, groups and access isolation',async()=>{
 for(let i=0;i<3;i++){await user(i);await rpc('profile',{username:['alice','bob','carol'][i],name:['Alice','Bob','Carol'][i]});}
 await user(0);
 await assert.rejects(()=>rpc('direct',{userId:ids[1]}),/friend first/);
 await rpc('request',{userId:ids[1]});
 const request=(await db.query('select id from public.friendships')).rows[0].id;
 await assert.rejects(()=>rpc('accept',{requestId:request}),/no longer available/);
 await user(1);await rpc('accept',{requestId:request});
 direct=(await rpc('direct',{userId:ids[0]})).id;
 await user(0);assert.equal((await rpc('direct',{userId:ids[1]})).id,direct);
 const clientId=crypto.randomUUID();const msg=await rpc('send',{chatId:direct,body:'Hello Bob',clientId});
 assert.equal((await rpc('send',{chatId:direct,body:'Hello Bob',clientId})).id,msg.id);
 await user(1);assert.equal((await rpc('history',{chatId:direct}))[0].body,'Hello Bob');
 const reply=await rpc('send',{chatId:direct,body:'<img src=x> literal text',clientId:crypto.randomUUID(),sender_id:ids[0]});
 assert.equal(reply.sender_id,ids[1]);
 await user(2);assert.equal((await db.query('select * from public.messages')).rows.length,0);
 assert.equal((await db.query('select * from public.conversation_members')).rows.length,0);
 await assert.rejects(()=>rpc('history',{chatId:direct}),/not available/);
 await assert.rejects(()=>rpc('send',{chatId:direct,body:'Intrusion',clientId:crypto.randomUUID()}),/not available/);
 await assert.rejects(()=>db.query('insert into public.conversation_members values($1,$2)',[direct,ids[2]]),/permission denied/);
 await user(0);group=(await rpc('group',{title:'Study group',members:[ids[1]]})).id;
 await assert.rejects(()=>rpc('group',{title:'Bad group',members:[ids[2]]}),/accepted friends/);
 await user(1);await assert.rejects(()=>rpc('add_member',{chatId:group,userId:ids[2]}),/Only the group owner/);
 await rpc('leave',{chatId:group});await assert.rejects(()=>rpc('history',{chatId:group}),/not available/);
 await user(0);await rpc('add_member',{chatId:group,userId:ids[1]});
 await assert.rejects(()=>rpc('leave',{chatId:group}),/owner cannot leave/);
 await user(1);assert.deepEqual(await rpc('history',{chatId:group}),[]);
 await assert.rejects(()=>rpc('send',{chatId:group,body:' ',clientId:crypto.randomUUID()}),/1–2000/);
 await db.exec('reset role');
 for(let i=0;i<65;i++)await db.query('insert into public.messages(conversation_id,sender_id,body,client_id) values($1,$2,$3,$4)',[group,ids[0],`History ${i}`,crypto.randomUUID()]);
 await user(1);const recent=await rpc('history',{chatId:group});assert.equal(recent.length,50);assert.equal(recent.at(-1).body,'History 64');
 const older=await rpc('history',{chatId:group,before:recent[0].id});assert.equal(older.length,15);assert.equal(older[0].body,'History 0');
 await assert.rejects(()=>db.query('update public.messages set body=$1 where conversation_id=$2',['forged',group]),/permission denied/);
 await assert.rejects(()=>rpc('profile',{username:'alice',name:'Copy'}),/already in use/);
 await db.exec('reset role;set role anon');await assert.rejects(()=>rpc('history',{chatId:direct}),/permission denied/);
});
after(async()=>{await db.close();});
