import {mkdir,writeFile} from 'node:fs/promises';
import {publicConfig} from '../Client/src/auth-utils.ts';
export async function configureVercel(env, target) {
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in Vercel Project Settings > Environment Variables, then redeploy.');
  const config=publicConfig(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY);
  await mkdir(new URL('.',target),{recursive:true});
  await writeFile(target,JSON.stringify(config,null,2)+'\n');
}
if (process.argv.includes('--write')) {
  try { await configureVercel(process.env,new URL('../Client/public/config.json',import.meta.url)); console.log('Public Supabase configuration prepared.'); }
  catch(error) { console.error(error.message);process.exitCode=1; }
}
