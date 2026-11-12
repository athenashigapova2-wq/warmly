import {test,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'];
await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
await db.exec(await readFile(new URL('../supabase/migrations/202611110002_messenger.sql',import.meta.url),'utf8'));
for(const id of ids)await db.query('insert into auth.users values($1)',[id]);
async function user(index){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[index]||'']);await db.exec('set role authenticated');}
async function rpc(action,payload={}){return (await db.query('select public.messenger($1,$2::jsonb) as result',[action,JSON.stringify(payload)])).rows[0].result;}

for(const file of ['202611110003_social.sql','202611110004_account.sql','202611110005_market_events.sql','202611110005_market_events.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
async function choose(choice,institution=''){await db.query('select choose_account_role($1,$2)',[choice,institution]);}
async function role(){return (await db.query('select warmly_role() as role')).rows[0].role;}
async function createEvent(title='Campus meetup',capacity=2){return (await db.query("insert into campus_events(title,location,starts_at,capacity) values($1,'Main hall',now()+interval '2 days',$2) returning id",[title,capacity])).rows[0].id;}
test('roles, marketplace, seller chat and university event authority enforced by PostgreSQL',async()=>{
 for(let i=0;i<4;i++){await user(i);await rpc('profile',{username:['student','visitor','university','outsider'][i],name:['Student','Visitor','University','Outsider'][i]});}
 await user(0);await choose('student');assert.equal(await role(),'student');
 await assert.rejects(()=>db.query("update account_roles set approved=true"),/permission denied/);
 await assert.rejects(()=>db.query("insert into account_roles(user_id,requested_role,approved) values($1,'university',true)",[ids[3]]),/permission denied/);
 await assert.rejects(()=>createEvent(),/row-level security/);
 const item=(await db.query("insert into book_listings(title,price,published,category) values('Calculus',25,true,'Books') returning id")).rows[0].id;
 const draft=(await db.query("insert into book_listings(title,price) values('Private draft',10) returning id")).rows[0].id;
 await assert.rejects(()=>db.query('select market_chat($1)',[item]),/own listing/);
 await user(1);await choose('visitor');assert.equal(await role(),'visitor');await choose('student');assert.equal(await role(),'visitor');
 await assert.rejects(()=>db.query("insert into book_listings(title) values('Forbidden')"),/row-level security/);
 await assert.rejects(()=>createEvent(),/row-level security/);
 assert.equal((await db.query('select * from book_listings')).rows.length,1);
 assert.equal((await db.query("update book_listings set title='Hijacked' where id=$1 returning id",[item])).rows.length,0);
 await assert.rejects(()=>db.query('select market_chat($1)',[draft]),/no longer available/);
 const chat=(await db.query('select market_chat($1) as id',[item])).rows[0].id;
 assert.equal((await db.query('select market_chat($1) as id',[item])).rows[0].id,chat);
 assert.equal((await db.query('select * from conversation_members where conversation_id=$1',[chat])).rows.length,2);
 await rpc('send',{chatId:chat,body:'Is this still available?',clientId:crypto.randomUUID()});
 assert.equal((await db.query('select * from friendships')).rows.length,0);
 await user(3);assert.equal(await role(),'visitor');await assert.rejects(()=>db.query("insert into book_listings(title) values('No role')"),/row-level security/);await assert.rejects(()=>rpc('history',{chatId:chat}),/not available/);
 await user(0);assert.equal((await rpc('history',{chatId:chat})).length,1);await db.query("update book_listings set status='sold' where id=$1",[item]);
 await user(1);await assert.rejects(()=>db.query('select market_chat($1)',[item]),/no longer available/);
 await user(2);await assert.rejects(()=>choose('university',''),/university name/);await choose('university','Warmly University');assert.equal(await role(),'visitor');await assert.rejects(()=>createEvent(),/row-level security/);
 await db.exec('reset role');await db.query('update account_roles set approved=true where user_id=$1',[ids[2]]);await user(2);assert.equal(await role(),'university');
 const event=await createEvent();await assert.rejects(()=>db.query("insert into campus_events(title,location,starts_at) values('Past','Hall',now()-interval '1 day')"),/future/);
 await assert.rejects(()=>db.query("insert into campus_events(title,location,starts_at,owner_id) values('Forged','Hall',now()+interval '1 day',$1)",[ids[0]]),/permission denied/);
 await user(0);await db.query('select register_event($1)',[event]);await db.query('select register_event($1)',[event]);assert.equal((await db.query('select * from event_registrations')).rows.length,1);
 await user(1);await db.query('select register_event($1)',[event]);assert.equal((await db.query('select * from event_registrations')).rows.length,1);assert.equal((await db.query("update campus_events set title='Hijacked' where id=$1 returning id",[event])).rows.length,0);
 await assert.rejects(()=>db.query('insert into event_registrations(event_id,user_id) values($1,$2)',[event,ids[3]]),/permission denied/);
 await user(3);await assert.rejects(()=>db.query('select register_event($1)',[event]),/full/);
 await user(2);assert.equal((await db.query('select * from event_registrations')).rows.length,2);await assert.rejects(()=>db.query('update campus_events set capacity=1 where id=$1',[event]),/lower than existing/);
 await user(1);await db.query('delete from event_registrations where event_id=$1',[event]);await user(3);await db.query('select register_event($1)',[event]);
 await user(2);await db.query("update campus_events set status='cancelled' where id=$1",[event]);await user(1);await assert.rejects(()=>db.query('select register_event($1)',[event]),/closed/);
 await user(2);const past=await createEvent('Later event');await db.exec('reset role');await db.exec('alter table campus_events disable trigger validate_campus_event');await db.query("update campus_events set starts_at=now()-interval '1 day' where id=$1",[past]);await db.exec('alter table campus_events enable trigger validate_campus_event');await user(1);await assert.rejects(()=>db.query('select register_event($1)',[past]),/closed/);
 await db.exec('reset role');await db.query('update account_roles set approved=false where user_id=$1',[ids[2]]);await user(2);assert.equal(await role(),'visitor');await assert.rejects(()=>createEvent(),/row-level security/);assert.equal((await db.query("update campus_events set title='Revoked' where id=$1 returning id",[event])).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from campus_events'),/permission denied/);await assert.rejects(()=>db.query('select market_chat($1)',[item]),/permission denied/);
});
after(()=>db.close());
