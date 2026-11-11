import {readFile} from 'node:fs/promises';
import {publicConfig} from '../Client/src/auth-utils.ts';
try {
  const config=JSON.parse(await readFile(new URL('../Client/public/config.json',import.meta.url),'utf8'));
  publicConfig(config.url,config.key);
  if(Object.keys(config).some(key=>!['url','key'].includes(key)))throw new Error('Only url and key are allowed in public config.');
  console.log('Public Supabase configuration validated.');
}catch(error){
  if(error.code==='ENOENT')console.warn('No bundled config.json. Run npm run configure before distributing this build. Existing browser configuration still works.');
  else {console.error('Unsafe or invalid public configuration. '+error.message);process.exitCode=1;}
}
