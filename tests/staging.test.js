import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deploymentConfig,stagingTarget} from '../scripts/environment-policy.mjs';
const env={VERCEL_ENV:'preview',STAGING_SUPABASE_PROJECT_REF:'stagingref',PRODUCTION_SUPABASE_PROJECT_REF:'prodref',STAGING_SUPABASE_URL:'https://stagingref.supabase.co',STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',SUPABASE_URL:'https://prodref.supabase.co',SUPABASE_PUBLISHABLE_KEY:'sb_publishable_prod'};
test('preview has no production fallback and refuses cross-environment URLs',()=>{
 assert.equal(deploymentConfig(env).url,env.STAGING_SUPABASE_URL);
 assert.equal(deploymentConfig(env).environment,'staging');
 assert.throws(()=>deploymentConfig({...env,VERCEL:'1',VERCEL_ENV:''}),/environment is unknown/);
 for(const key of ['STAGING_SUPABASE_PROJECT_REF','PRODUCTION_SUPABASE_PROJECT_REF','STAGING_SUPABASE_URL','STAGING_SUPABASE_PUBLISHABLE_KEY'])assert.throws(()=>deploymentConfig({...env,[key]:''}));
 assert.throws(()=>deploymentConfig({...env,STAGING_SUPABASE_URL:env.SUPABASE_URL}));
 assert.throws(()=>stagingTarget({...env,STAGING_SUPABASE_PROJECT_REF:'prodref'}));
 assert.throws(()=>deploymentConfig({...env,VERCEL_ENV:'production',SUPABASE_URL:env.STAGING_SUPABASE_URL}));
 assert.equal(deploymentConfig({...env,VERCEL_ENV:'production'}).url,env.SUPABASE_URL);
});
