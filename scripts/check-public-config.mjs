import {readFile} from 'node:fs/promises';
import {validatePublicConfig} from './validate-public-config.mjs';
try {
  const config=JSON.parse(await readFile(new URL('../Client/public/config.json',import.meta.url),'utf8'));
  validatePublicConfig(config);
  console.log('Public Supabase configuration validated.');
}catch(error){
  if(error.code==='ENOENT')console.warn('No bundled config.json. Run npm run configure before distributing this build. Existing browser configuration still works.');
  else {console.error('Unsafe or invalid public configuration. '+error.message);process.exitCode=1;}
}
