import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {fixtureAccounts,fixtureRows,fixtureId} from '../scripts/staging-fixtures.mjs';

test('synthetic fixtures survive a LOCAL PGlite snapshot and retain application RLS (not hosted Auth/backup proof)',async()=>{
 const source=new PGlite();let restored;
 try{
  await source.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
  for(const name of ['002_messenger','003_social','004_account','005_market_events'])await source.exec(await readFile(new URL('../supabase/migrations/202611110'+name+'.sql',import.meta.url),'utf8'));
  const ids=Object.fromEntries(fixtureAccounts.map((a,i)=>[a.slug,fixtureId(100+i)]));
  for(const id of Object.values(ids))await source.query('insert into auth.users values($1)',[id]);
  const fixtures=fixtureRows(ids);
  for(const [table,rows] of fixtures)for(const row of rows){const keys=Object.keys(row);await source.query(`insert into ${table} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(row));}
  async function fingerprint(db){const result={};for(const [table] of fixtures)result[table]=(await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as rows from ${table} t`)).rows[0].rows;return result;}
  const baseline=await fingerprint(source);
  const snapshot=await source.dumpDataDir();
  await source.query('delete from messages');
  assert.notDeepEqual(await fingerprint(source),baseline);
  restored=new PGlite({loadDataDir:snapshot});
  assert.deepEqual(await fingerprint(restored),baseline);
  const asUser=async slug=>{await restored.exec('reset role');await restored.query("select set_config('request.jwt.claim.sub',$1,false)",[ids[slug]]);await restored.exec('set role authenticated');};
  await asUser('alice');assert.equal((await restored.query('select * from messages')).rows.length,2);
  assert.equal((await restored.query('select * from social_posts where author_id=$1',[ids.outsider])).rows.length,0);
  await asUser('outsider');assert.equal((await restored.query('select * from messages')).rows.length,0);
  await asUser('visitor');assert.equal((await restored.query('select * from book_listings')).rows.length,1);
  await assert.rejects(()=>restored.query("insert into book_listings(title) values('Forbidden')"),/row-level security/);
  await asUser('pending');assert.equal((await restored.query('select warmly_role() as role')).rows[0].role,'visitor');
  await asUser('university');assert.equal((await restored.query('select warmly_role() as role')).rows[0].role,'university');
  await restored.exec('reset role; set role anon');await assert.rejects(()=>restored.query('select * from messages'),/permission denied/);
 }finally{await source.close();if(restored)await restored.close();}
});
