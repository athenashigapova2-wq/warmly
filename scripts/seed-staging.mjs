import {createClient} from '@supabase/supabase-js';
import {randomBytes} from 'node:crypto';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {stagingTarget} from './environment-policy.mjs';
import {fixtureAccounts,fixtureRows} from './staging-fixtures.mjs';
import {writeFixtures} from './write-fixtures.mjs';
const ref=stagingTarget(process.env);
if(process.env.CONFIRM_STAGING_REF!==ref)throw Error('Set CONFIRM_STAGING_REF to the staging project ref.');
if(!process.env.STAGING_SUPABASE_SECRET_KEY)throw Error('Set the staging secret/service_role key locally only.');
const client=createClient(process.env.STAGING_SUPABASE_URL,process.env.STAGING_SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const checked=async request=>{const {data,error}=await request;if(error)throw Error(error.message);return data;};
const marker=await checked(client.rpc('warmly_staging_identity'));
if(marker!==ref)throw Error('Staging identity marker missing or mismatched. No seed writes made.');
let existing=[];
for(let page=1;;page++){const data=await checked(client.auth.admin.listUsers({page,perPage:100}));existing.push(...data.users);if(data.users.length<100)break;}
const ids={},credentials=[];
const output=new URL(`../staging-local/accounts-${ref}.json`,import.meta.url);
await mkdir(new URL('.',output),{recursive:true});
try {credentials.push(...JSON.parse(await readFile(output,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
for(const fixture of fixtureAccounts){
 const email=`${fixture.slug}@warmly.example`;
 let user=existing.find(u=>u.email===email);
 if(user && user.app_metadata?.warmly_fixture!==true)throw Error('Refusing to overwrite a non-fixture account: '+email);
 if(!user){
  const password=randomBytes(24).toString('base64url');
  user=(await checked(client.auth.admin.createUser({email,password,email_confirm:true,app_metadata:{warmly_fixture:true}}))).user;
  credentials.push({email,password,id:user.id});
  // Write after each creation so a later failure does not lose already-created credentials.
  await writeFile(output,JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
 }
 ids[fixture.slug]=user.id;
}
await writeFixtures(client,fixtureRows(ids));
console.log(`Seeded 7 synthetic accounts and fixtures. Existing passwords were not reset. Credentials: staging-local/accounts-${ref}.json (local only).`);
