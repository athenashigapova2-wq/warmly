// UI-only fixture. Built exclusively with --configuration=qa; no network/database writes.
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from '../Client/src/app';
import {MessengerApi} from '../Client/src/transport';
const people:any[]=[{id:'alice',name:'Amina',username:'amina',university:'Lund University'},{id:'bob',name:'Lucas',username:'lucas',university:'Lund University'},{id:'carol',name:'Emma',username:'emma',university:'Uppsala University'},{id:'dave',name:'Noah',username:'noah',university:'Lund University'}];
Object.assign(people[1],{program:'Computer Science · Year 2',bio:'Always up for a study session, a good coffee and an unexpected adventure.',interests:'Technology, Coffee, Hiking, Music'});
Object.assign(people[2],{program:'Psychology · Year 2',bio:'Learning about people, one conversation at a time.',interests:'Reading, Yoga, Travel'});
Object.assign(people[3],{program:'Engineering · Year 1',bio:'New to campus. Let’s build something great together.',interests:'Design, Photography, Cycling'});
if(new URLSearchParams(location.search).has('missingUniversity'))people[0].university='';
const chats:any[]=[{id:'direct',kind:'direct',title:'Direct message',owner:'alice',created_at:'2026-11-11T10:00:00Z'},{id:'group',kind:'group',title:'Design study group',owner:'alice',created_at:'2026-11-11T09:00:00Z'}];
const members:any[]=[{conversation_id:'direct',user_id:'alice'},{conversation_id:'direct',user_id:'bob'},...people.map(p=>({conversation_id:'group',user_id:p.id}))];
const friends:any[]=[{id:'f1',sender:'alice',recipient:'bob',status:'accepted'},{id:'f2',sender:'carol',recipient:'alice',status:'pending'}];
const messages:any[]=[{id:1,conversation_id:'direct',sender_id:'bob',body:'Hey! Are we meeting at the library tomorrow?',created_at:'2026-11-11T10:01:00Z'},{id:2,conversation_id:'direct',sender_id:'alice',body:'Yes! Let’s grab a coffee first ☕',created_at:'2026-11-11T10:02:00Z'}];
const posts:any[]=[{id:'demo-post',author_id:'bob',kind:'post',body:'Looking for a study buddy for next week. Coffee at the library?',image:'',created_at:new Date().toISOString()},{id:'demo-story',author_id:'carol',kind:'story',body:'A good day for new ideas ✨',image:'',created_at:new Date().toISOString()}];
function socialQuery(){let kind='post';const q:any={select:()=>q,eq:(key:string,v:string)=>{if(key==='kind')kind=v;return q;},gt:()=>q,order:()=>q,or:()=>q,limit:async()=>({data:structuredClone(posts.filter(p=>p.kind===kind))}),insert:async(p:any)=>{posts.unshift({...p,author_id:'alice',created_at:new Date().toISOString()});return {};},delete:()=>({eq:(_:string,id:string)=>({eq:async()=>{const at=posts.findIndex(p=>p.id===id);if(at>=0)posts.splice(at,1);return {};}})})};return q;}
if(new URLSearchParams(location.search).has('empty'))messages.length=0;
const roleParam=new URLSearchParams(location.search).get('role')||'student';
const roles:any[]=[{user_id:'alice',requested_role:roleParam==='pending'?'university':roleParam,approved:roleParam==='university',university_name:'Warmly University'}];
const listings:any[]=[{id:'book1',owner_id:'bob',title:'Calculus: Early Transcendentals',author:'James Stewart',price:40,currency:'SEK',condition:'Like new',description:'A useful companion for your first year. Clean pages and a few helpful notes.',category:'Books',image:'',published:true,status:'available',created_at:new Date().toISOString()}];
const campusEvents:any[]=[{id:'event1',owner_id:'bob',title:'Welcome Week Meetup',location:'Main campus courtyard',description:'Meet your new campus community over coffee and conversation.',starts_at:new Date(Date.now()+86400000*2).toISOString(),capacity:30,image:'',status:'scheduled',created_at:new Date().toISOString()}];
const registrations:any[]=[];
function fixtureQuery(table:string){const source=table==='profiles'?people:table==='account_roles'?roles:table==='book_listings'?listings:table==='campus_events'?campusEvents:registrations;let filters:((r:any)=>boolean)[]=[];let mutation='';let values:any;let projection='';
 const result=()=>{let rows=source.filter(r=>filters.every(f=>f(r)));if(mutation==='insert'){const row={...values,owner_id:'alice',created_at:new Date().toISOString()};source.push(row);rows=[row];mutation='';}else if(mutation==='update'){rows.forEach(r=>Object.assign(r,values));mutation='';}else if(mutation==='delete'){for(const r of rows)source.splice(source.indexOf(r),1);mutation='';}return {data:structuredClone(rows)};};
 const q:any={select:(p:string)=>{projection=p;return q;},eq:(k:string,v:any)=>{filters.push(r=>r[k]===v);return q;},neq:(k:string,v:any)=>{filters.push(r=>r[k]!==v);return q;},gt:(k:string,v:any)=>{filters.push(r=>r[k]>v);return q;},in:(k:string,v:any[])=>{filters.push(r=>v.includes(r[k]));return q;},ilike:(k:string,v:string)=>{filters.push(r=>String(r[k]).toLowerCase().includes(v.replaceAll('%','').toLowerCase()));return q;},order:()=>q,range:async(a:number,b:number)=>{const r=result();r.data=r.data.slice(a,b+1);return r;},limit:async(n:number)=>{const r=result();r.data=r.data.slice(0,n);return r;},maybeSingle:async()=>table==='profiles'&&projection.includes('bio')&&new URLSearchParams(location.search).has('profileError')?({data:null,error:{message:'Fixture network failure'}}):({data:result().data[0]||null}),insert:(v:any)=>{mutation='insert';values=v;return q;},update:(v:any)=>{mutation='update';values=v;return q;},delete:()=>{mutation='delete';return q;},then:(resolve:any,reject:any)=>Promise.resolve(result()).then(resolve,reject)};return q;}
class FixtureApi {
 client:any={
  auth:{getSession:async()=>({data:{session:{user:{id:'alice'}}}}),onAuthStateChange:()=>{},signOut:async()=>({})},
  rpc:async(action:string,p:any)=>{if(action==='market_chat')return {data:'direct'};if(action==='register_event'){if(!registrations.some(r=>r.event_id===p.target&&r.user_id==='alice'))registrations.push({event_id:p.target,user_id:'alice',created_at:new Date().toISOString()});return {};}return {};},
  from:(table:string)=>table==='social_posts'?socialQuery():fixtureQuery(table)
 };
 configure(){}
 async finishOAuth(){return false;}
 async watchNativeCallback(){}
 async table(name:string){return structuredClone(name==='friendships'?friends:name==='conversations'?chats:members);}
 async rpc(action:string,p:any={}){
  if(action==='history')return structuredClone(messages.filter(m=>m.conversation_id===p.chatId));
  if(action==='send'){const m={id:messages.length+1,conversation_id:p.chatId,sender_id:'alice',body:p.body,created_at:new Date().toISOString()};messages.push(m);return m;}
  if(action==='request'&&!friends.some(f=>f.sender===p.userId||f.recipient===p.userId))friends.push({id:'request-'+p.userId,sender:'alice',recipient:p.userId,status:'pending'});
  if(action==='profile'){people[0].name=p.name;people[0].username=p.username;}
  if(action==='accept')friends.find(f=>f.id===p.requestId).status='accepted';
  if(action==='direct')return {id:'direct'};
  if(action==='group'){const id='new-group';chats.push({id,kind:'group',title:p.title,owner:'alice',created_at:new Date().toISOString()});for(const user_id of ['alice',...p.members])members.push({conversation_id:id,user_id});return {id};}
  return {};
 }
}
bootstrapApplication(App,{providers:[{provide:MessengerApi,useClass:FixtureApi}]}).then(ref=>{
 const app=ref.components[0].instance as App;app.url='https://fixture.supabase.co';app.key='sb_publishable_fixture';void app.connect();
});
