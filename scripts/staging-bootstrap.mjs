import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {stagingTarget} from './environment-policy.mjs';
// Generates SQL for a NEW EMPTY staging project only; never connects to a database.
const ref=stagingTarget(process.env);
const dir=new URL('../supabase/migrations/',import.meta.url);
const files=(await readdir(dir)).filter(x=>x.endsWith('.sql')).sort();
let sql=`-- NEW EMPTY Warmly Staging ONLY: ${ref}\n-- Verify the selected Dashboard project before running.\nbegin;\ndo $$ begin\n if exists(select 1 from auth.users) or to_regclass('public.profiles') is not null then\n raise exception 'Bootstrap requires an empty project'; end if;\nend $$;\n`;
for(const file of files){
 const source=await readFile(new URL(file,dir),'utf8');
 sql+=`\n-- ${file}\n`+source.replace(/^\s*(begin|commit);\s*$/gim,'')+'\n';
}
sql+=`\ncreate function public.warmly_staging_identity() returns text language sql stable set search_path='' as $$ select '${ref}'::text $$;\nrevoke all on function public.warmly_staging_identity() from public, anon, authenticated;\ngrant execute on function public.warmly_staging_identity() to service_role;\ncommit;\n`;
const output=new URL('../staging-local/bootstrap.sql',import.meta.url);
await mkdir(new URL('.',output),{recursive:true});await writeFile(output,sql);
console.log('Prepared staging-local/bootstrap.sql for empty staging project '+ref+'. No remote changes made.');
