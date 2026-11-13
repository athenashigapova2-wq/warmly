import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
test('media, reactions and comments enforce contact visibility, ownership and expiry in PostgreSQL',async()=>{
 const db=new PGlite();const ids=[1,2,3].map(n=>`00000000-0000-4000-8000-00000000000${n}`);
 try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert,delete on storage.objects to authenticated;`);
 for(const file of ['202611110002_messenger.sql','202611110003_social.sql','202611110004_account.sql','202611110005_market_events.sql','202611130006_discover_media.sql','202611130006_discover_media.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 for(let i=0;i<3;i++){await db.query('insert into auth.users values($1)',[ids[i]]);await db.query('insert into profiles(id,username,name) values($1,$2,$2)',[ids[i],'user'+i]);}
 await db.query("insert into friendships(sender,recipient,status) values($1,$2,'accepted')",[ids[0],ids[1]]);
 async function user(i){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[i]]);await db.exec('set role authenticated');}
 await user(0);
 const path=ids[0]+'/'+ids[0]+'.jpg';
 await db.query("insert into storage.objects values('warmly-social',$1),('warmly-avatars',$1)",[path]);
 await db.query('update profiles set avatar_path=$1 where id=$2',[path,ids[0]]);
 const post=(await db.query("insert into social_posts(kind,media_type,media_path) values('post','image',$1) returning id",[path])).rows[0].id;
 const story=(await db.query("insert into social_posts(kind,body) values('story','Temporary') returning id")).rows[0].id;
 await user(1);
 assert.equal((await db.query("select * from storage.objects where bucket_id='warmly-social'")).rows.length,1);
 await db.query("insert into post_reactions(post_id,kind) values($1,'heart')",[post]);
 await db.query("update post_reactions set kind='thumb' where post_id=$1",[post]);
 await assert.rejects(()=>db.query("insert into post_reactions(post_id,kind) values($1,'heart')",[post]),/duplicate/);
 const comment=(await db.query("insert into post_comments(post_id,body) values($1,'Hello!') returning id",[post])).rows[0].id;
 await assert.rejects(()=>db.query("insert into post_comments(post_id,body) values($1,'Too fast')",[post]),/wait a moment/);
 await assert.rejects(()=>db.query("insert into post_comments(post_id,body,author_id) values($1,'Spoof',$2)",[post,ids[0]]),/permission denied/);
 await assert.rejects(()=>db.query("insert into social_posts(kind,media_type,media_path) values('post','image',$1)",[path]),/check constraint/);
 await assert.rejects(()=>db.query('update profiles set avatar_path=$1 where id=$2',[path,ids[1]]),/check constraint/);
 const stats=(await db.query('select * from social_activity($1::uuid[])',[[post]])).rows[0];
 assert.equal(Number(stats.thumbs),1);assert.equal(Number(stats.comments),1);assert.equal(stats.mine,'thumb');
 await user(2);
 assert.equal((await db.query('select * from post_comments')).rows.length,0);
 assert.equal((await db.query('select * from post_reactions')).rows.length,0);
 assert.equal((await db.query('select * from social_activity($1::uuid[])',[[post]])).rows.length,0);
 assert.equal((await db.query("select * from storage.objects where bucket_id='warmly-social'")).rows.length,0);
 assert.equal((await db.query("select * from storage.objects where bucket_id='warmly-avatars'")).rows.length,1);
 await assert.rejects(()=>db.query("insert into post_comments(post_id,body) values($1,'Intrusion')",[post]),/row-level security/);
 await assert.rejects(()=>db.query("insert into post_reactions(post_id,kind) values($1,'heart')",[post]),/row-level security/);
 await assert.rejects(()=>db.query("insert into storage.objects values('warmly-social',$1)",[ids[0]+'/'+ids[1]+'.mp4']),/row-level security/);
 await user(0);assert.equal((await db.query('delete from post_comments where id=$1 returning id',[comment])).rows.length,1);
 await db.exec('reset role');await db.query("update social_posts set created_at=now()-interval '25 hours' where id=$1",[story]);
 await user(1);await assert.rejects(()=>db.query("insert into post_reactions(post_id,kind) values($1,'heart')",[story]),/row-level security/);
 await db.exec('reset role');await db.query('delete from friendships');await user(1);
 assert.equal((await db.query('select * from post_reactions')).rows.length,0);
 assert.equal((await db.query("select * from storage.objects where bucket_id='warmly-social'")).rows.length,0);
 await db.exec('reset role;set role anon');await assert.rejects(()=>db.query('select * from post_comments'),/permission denied/);
 }finally{await db.close();}
});
