import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {configureVercel} from '../scripts/configure-vercel.mjs';
import {validatePublicConfig} from '../scripts/validate-public-config.mjs';
test('cloud config fails closed and bundles only validated public settings',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'warmly-config-'));
 const target=pathToFileURL(join(dir,'config.json'));
 try {
  await assert.rejects(configureVercel({},target),/Set SUPABASE_URL/);
  await assert.rejects(configureVercel({SUPABASE_URL:'https://test.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_secret_forbidden'},target),/publishable or anon/);
  await assert.rejects(readFile(target),{code:'ENOENT'});
  await configureVercel({SUPABASE_URL:'https://test.supabase.co/',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',UNRELATED_SECRET:'never-bundle'},target);
  assert.deepEqual(JSON.parse(await readFile(target,'utf8')),{url:'https://test.supabase.co',key:'sb_publishable_fixture'});
  validatePublicConfig(JSON.parse(await readFile(target,'utf8')));
  await configureVercel({VERCEL_ENV:'preview',STAGING_SUPABASE_PROJECT_REF:'staging',PRODUCTION_SUPABASE_PROJECT_REF:'production',STAGING_SUPABASE_URL:'https://staging.supabase.co',STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture'},target);
  const preview=JSON.parse(await readFile(target,'utf8'));
  assert.equal(preview.environment,'staging');
  validatePublicConfig(preview);
  assert.throws(()=>validatePublicConfig({...preview,secret:'forbidden'}),/Only url/);
  assert.throws(()=>validatePublicConfig({...preview,key:'sb_secret_forbidden'}),/publishable or anon/);
  for(const environment of ['production','invalid',null,{}])assert.throws(()=>validatePublicConfig({...preview,environment}),/environment/);
 } finally {await rm(dir,{recursive:true,force:true});}
});
