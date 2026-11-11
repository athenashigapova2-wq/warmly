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

await db.exec(await readFile(new URL('../supabase/migrations/202611110003_social.sql',import.meta.url),'utf8'));
await db.exec(await readFile(new URL('../supabase/migrations/202611110003_social.sql',import.meta.url),'utf8'));

test('social privacy, ownership, expiry, media constraints and editable profiles',async()=>{
 for(let i=0;i<3;i++){await user(i);await rpc('profile',{username:['alice','bob','carol'][i],name:['Alice','Bob','Carol'][i]});}
 await user(0);
 const post=(await db.query("insert into public.social_posts(kind,body) values('post','Hello circle') returning id")).rows[0].id;
 const story=(await db.query("insert into public.social_posts(kind,body) values('story','Today') returning id")).rows[0].id;
 await assert.rejects(()=>db.query("insert into public.social_posts(kind,body,author_id) values('post','Forged',$1)",[ids[1]]),/permission denied/);
 await assert.rejects(()=>db.query("insert into public.social_posts(kind,body,created_at) values('story','Forever',now())"),/permission denied/);
 await assert.rejects(()=>db.query("insert into public.social_posts(kind,image) values('post','https://tracking.invalid/image')"),/check constraint/);
 await assert.rejects(()=>db.query("insert into public.social_posts(kind,body) values('post',' ')"),/check constraint/);
 await user(1);assert.equal((await db.query('select * from public.social_posts')).rows.length,0);
 await rpc('request',{userId:ids[0]});assert.equal((await db.query('select * from public.social_posts')).rows.length,0);
 await user(0);const req=(await db.query('select id from public.friendships')).rows[0].id;await rpc('accept',{requestId:req});
 await user(1);assert.equal((await db.query('select * from public.social_posts')).rows.length,2);
 assert.equal((await db.query('delete from public.social_posts where id=$1 returning id',[post])).rows.length,0);
 assert.equal((await db.query("update public.profiles set bio='Forged' where id=$1 returning id",[ids[0]])).rows.length,0);
 await db.query("update public.profiles set bio='I love science',university='Lund',program='Year 2',interests='Books' where id=$1",[ids[1]]);
 assert.equal((await db.query('select bio from public.profiles where id=$1',[ids[1]])).rows[0].bio,'I love science');
 await user(2);assert.equal((await db.query('select * from public.social_posts')).rows.length,0);
 await db.exec('reset role');await db.query("update public.social_posts set created_at=now()-interval '25 hours' where id=$1",[story]);
 await user(1);assert.equal((await db.query('select * from public.social_posts')).rows.length,1);
 await user(0);await db.query('delete from public.social_posts where id=$1',[post]);assert.equal((await db.query('select * from public.social_posts')).rows.length,0);
 await user(-1);assert.equal((await db.query('select * from public.social_posts')).rows.length,0);
});
after(()=>db.close());
