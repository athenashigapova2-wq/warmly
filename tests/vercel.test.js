import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {configureVercel} from '../scripts/configure-vercel.mjs';
test('cloud config fails closed and bundles only validated public settings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'warmly-config-'));
 const target=pathToFileURL(join(dir,'config.json'));
 try {
  await assert.rejects(configureVercel({},target),/Set SUPABASE_URL/);
  await assert.rejects(configureVercel({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_forbidden'},target),/publishable or anon/);
  await assert.rejects(readFile(target),{code:'ENOENT'});
  await configureVercel({SUPABASE_URL:'https://test.supabase.co/',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',UNRELATED_SECRET:'never-bundle'},target);
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{url:'https://test.supabase.co',key:'sb_publishable_fixture'});
 } finally {await rm(dir,{recursive:true,force:true});}
});
