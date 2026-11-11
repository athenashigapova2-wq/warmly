import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import {writeFile,mkdir} from 'node:fs/promises';
import {publicConfig} from '../Client/src/auth-utils.ts';
const prompt=createInterface({input:stdin,output:stdout});
try {
  console.log('One-time developer setup. These PUBLIC settings will be bundled with web and Android. Never enter a secret/service_role key.');
  const url=await prompt.question('Supabase Project URL: ');
  const key=await prompt.question('Supabase publishable key (or anon key): ');
  const config=publicConfig(url,key);
  await mkdir(new URL('../Client/public/',import.meta.url),{recursive:true});
  await writeFile(new URL('../Client/public/config.json',import.meta.url),JSON.stringify(config,null,2)+'\n');
  console.log('Saved public configuration locally. Run npm start or npm run android:sync. Users will not enter these settings.');
}catch(error){console.error(error.message);process.exitCode=1;}finally{prompt.close();}
