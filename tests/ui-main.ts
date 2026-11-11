// UI-only fixture. Built exclusively with --configuration=qa; no network/database writes.
import {bootstrapApplication} from '@angular/platform-browser';
import {App} from '../Client/src/app';
import {MessengerApi} from '../Client/src/transport';
const people=[{id:'alice',name:'Amina',username:'amina'},{id:'bob',name:'Lucas',username:'lucas'},{id:'carol',name:'Emma',username:'emma'}];
const chats:any[]=[{id:'direct',kind:'direct',title:'Direct message',owner:'alice',created_at:'2026-11-11T10:00:00Z'},{id:'group',kind:'group',title:'Design study group',owner:'alice',created_at:'2026-11-11T09:00:00Z'}];
const members:any[]=[{conversation_id:'direct',user_id:'alice'},{conversation_id:'direct',user_id:'bob'},...people.map(p=>({conversation_id:'group',user_id:p.id}))];
const friends:any[]=[{id:'f1',sender:'alice',recipient:'bob',status:'accepted'},{id:'f2',sender:'carol',recipient:'alice',status:'pending'}];
const messages:any[]=[{id:1,conversation_id:'direct',sender_id:'bob',body:'Hey! Are we meeting at the library tomorrow?',created_at:'2026-11-11T10:01:00Z'},{id:2,conversation_id:'direct',sender_id:'alice',body:'Yes! Let’s grab a coffee first ☕',created_at:'2026-11-11T10:02:00Z'}];
const posts:any[]=[{id:'demo-post',author_id:'bob',kind:'post',body:'Looking for a study buddy for next week. Coffee at the library?',image:'',created_at:new Date().toISOString()},{id:'demo-story',author_id:'carol',kind:'story',body:'A good day for new ideas ✨',image:'',created_at:new Date().toISOString()}];
function socialQuery(){let kind='post';const q:any={select:()=>q,eq:(key:string,v:string)=>{if(key==='kind')kind=v;return q;},gt:()=>q,order:()=>q,or:()=>q,limit:async()=>({data:structuredClone(posts.filter(p=>p.kind===kind))}),insert:async(p:any)=>{posts.unshift({...p,author_id:'alice',created_at:new Date().toISOString()});return {};},delete:()=>({eq:(_:string,id:string)=>({eq:async()=>{const at=posts.findIndex(p=>p.id===id);if(at>=0)posts.splice(at,1);return {};}})})};return q;}
class FixtureApi {
 client:any={
  auth:{getSession:async()=>({data:{session:{user:{id:'alice'}}}}),onAuthStateChange:()=>{},signOut:async()=>({})},
  from:(table:string)=>table==='social_posts'?socialQuery():({update:(fields:any)=>({eq:()=>({select:async()=>{Object.assign(people[0],fields);return {data:[{id:'alice'}]};}})}),select:()=>({
    eq:()=>({maybeSingle:async()=>({data:people[0]})}),
    in:async()=>({data:people}),
    like:()=>({neq:()=>({limit:async()=>({data:people.slice(1)})})})
  })})
 };
 configure(){}
 async finishOAuth(){return false;}
 async watchNativeCallback(){}
 async table(name:string){return structuredClone(name==='friendships'?friends:name==='conversations'?chats:members);}
 async rpc(action:string,p:any={}){
  if(action==='history')return structuredClone(messages.filter(m=>m.conversation_id===p.chatId));
  if(action==='send'){const m={id:messages.length+1,conversation_id:p.chatId,sender_id:'alice',body:p.body,created_at:new Date().toISOString()};messages.push(m);return m;}
  if(action==='accept')friends.find(f=>f.id===p.requestId).status='accepted';
  if(action==='direct')return {id:'direct'};
  if(action==='group'){const id='new-group';chats.push({id,kind:'group',title:p.title,owner:'alice',created_at:new Date().toISOString()});for(const user_id of ['alice',...p.members])members.push({conversation_id:id,user_id});return {id};}
  return {};
 }
}
bootstrapApplication(App,{providers:[{provide:MessengerApi,useClass:FixtureApi}]}).then(ref=>{
 const app=ref.components[0].instance as App;app.url='https://fixture.supabase.co';app.key='sb_publishable_fixture';void app.connect();
});
