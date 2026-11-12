import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {fixtureAccounts,fixtureRows,fixtureId} from '../scripts/staging-fixtures.mjs';
import {writeFixtures} from '../scripts/write-fixtures.mjs';

test('seed sends homogeneous PostgREST batches and preserves defaults on retries',async()=>{
 const requests=[];
 const client=createClient('https://fixture.supabase.co','sb_secret_test_only',{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:async(url,options)=>{
   const rows=JSON.parse(options.body);
   const keys=Object.keys(rows[0]).sort();
   for(const row of rows)assert.deepEqual(Object.keys(row).sort(),keys);
   const headers=new Headers(options.headers);
   assert.match(headers.get('prefer'),/missing=default/);
   assert.match(headers.get('prefer'),/resolution=merge-duplicates/);
   assert.ok(new URL(url).searchParams.get('on_conflict'));
   requests.push({table:new URL(url).pathname.split('/').at(-1),rows});
   return new Response(null,{status:201});
  }}
 });
 const ids=Object.fromEntries(fixtureAccounts.map((a,i)=>[a.slug,fixtureId(100+i)]));
 const fixtures=fixtureRows(ids,new Date('2030-01-01T00:00:00Z'));
 await writeFixtures(client,fixtures);
 const first=structuredClone(requests);requests.length=0;
 await writeFixtures(client,fixtures);
 assert.deepEqual(requests,first);
 assert.equal(requests.filter(r=>r.table==='social_posts').length,2);
 assert.equal(requests.filter(r=>r.table==='book_listings').length,2);
 const posts=requests.filter(r=>r.table==='social_posts').flatMap(r=>r.rows);
 assert.equal(posts.length,3);
 assert.ok(posts.find(r=>r.kind==='story').created_at);
 assert.ok(posts.filter(r=>r.kind==='post').every(r=>!('created_at' in r)));
 const draft=requests.filter(r=>r.table==='book_listings').flatMap(r=>r.rows).find(r=>!r.published);
 assert.ok(!('currency' in draft));assert.ok(!('description' in draft));
});
