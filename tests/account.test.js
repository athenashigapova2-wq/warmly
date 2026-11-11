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

for(const file of ['202611110003_social.sql','202611110004_account.sql','202611110004_account.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
test('book listings and bookmarks are private and cannot bypass feed access',async()=>{
 for(let i=0;i<3;i++){await user(i);await rpc('profile',{username:['alice','bob','carol'][i],name:['Alice','Bob','Carol'][i]});}
 await user(0);const post=(await db.query("insert into social_posts(kind,body) values('post','Hello') returning id")).rows[0].id;
 const book=(await db.query("insert into book_listings(title,price) values('Calculus',25) returning id")).rows[0].id;
 await db.query('insert into saved_posts(post_id) values($1)',[post]);
 await user(1);assert.equal((await db.query('select * from book_listings')).rows.length,0);assert.equal((await db.query('select * from saved_posts')).rows.length,0);
 await assert.rejects(()=>db.query('insert into saved_posts(post_id) values($1)',[post]),/row-level security/);
 assert.equal((await db.query("update book_listings set status='sold' where id=$1 returning id",[book])).rows.length,0);
 await assert.rejects(()=>db.query("insert into book_listings(title,owner_id) values('Forged',$1)",[ids[0]]),/permission denied/);
 await rpc('request',{userId:ids[0]});await user(0);await rpc('accept',{requestId:(await db.query('select id from friendships')).rows[0].id});
 await user(1);await db.query('insert into saved_posts(post_id) values($1)',[post]);assert.equal((await db.query('select * from saved_posts')).rows.length,1);
 await user(0);await db.query("update book_listings set status='sold' where id=$1",[book]);assert.equal((await db.query('select status from book_listings')).rows[0].status,'sold');
 await assert.rejects(()=>db.query("insert into book_listings(title,price) values('Invalid',-1)"),/check constraint/);
 await db.query('delete from social_posts where id=$1',[post]);await user(1);assert.equal((await db.query('select * from saved_posts')).rows.length,0);
});
after(()=>db.close());
