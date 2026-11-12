import {mkdir,writeFile} from 'node:fs/promises';
import {publicConfig} from '../Client/src/auth-utils.ts';
import {deploymentConfig} from './environment-policy.mjs';
export async function configureVercel(env, target) {
  const selected=deploymentConfig(env);
  const config={...publicConfig(selected.url,selected.key),...(selected.environment?{environment:selected.environment}:{})};
  await mkdir(new URL('.',target),{recursive:true});
  await writeFile(target,JSON.stringify(config,null,2)+'\n');
}
if (process.argv.includes('--write')) {
  try { await configureVercel(process.env,new URL('../Client/public/config.json',import.meta.url)); console.log('Public Supabase configuration prepared.'); }
  catch(error) { console.error(error.message);process.exitCode=1; }
}
