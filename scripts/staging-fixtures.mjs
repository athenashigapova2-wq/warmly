export const fixtureAccounts=[
 {slug:'alice',name:'Alice Test',role:'student',university:'North Test University'},
 {slug:'ben',name:'Ben Test',role:'student',university:'North Test University'},
 {slug:'chloe',name:'Chloe Test',role:'student',university:'South Test University'},
 {slug:'visitor',name:'Visitor Test',role:'visitor',university:'South Test University'},
 {slug:'university',name:'University Test',role:'university',university:'North Test University',approved:true},
 {slug:'pending',name:'Pending University Test',role:'university',university:'South Test University'},
 {slug:'outsider',name:'Outsider Test',role:'student',university:'West Test University'},
];
export const fixtureId=n=>`71000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export function fixtureRows(ids,now=new Date()){
 const future=new Date(now.getTime()+7*86400000).toISOString();
 return [
  ['profiles',fixtureAccounts.map(a=>({id:ids[a.slug],username:'test_'+a.slug,name:a.name,university:a.university,program:'Synthetic testing',bio:'Synthetic staging account. Not a real person.',interests:'Testing, campus life'})),'id'],
  ['account_roles',fixtureAccounts.map(a=>({user_id:ids[a.slug],requested_role:a.role,university_name:a.role==='university'?a.university:'',approved:!!a.approved})),'user_id'],
  ['friendships',[{id:fixtureId(1),sender:ids.alice,recipient:ids.ben,status:'accepted'},{id:fixtureId(2),sender:ids.chloe,recipient:ids.alice,status:'pending'}],'id'],
  ['conversations',[{id:fixtureId(10),kind:'direct',title:'Direct message',owner:ids.alice,direct_key:[ids.alice,ids.ben].sort().join(':')},{id:fixtureId(11),kind:'group',title:'Staging study group',owner:ids.alice}],'id'],
  ['conversation_members',[10,11].flatMap(n=>[ids.alice,ids.ben].map(user_id=>({conversation_id:fixtureId(n),user_id}))),'conversation_id,user_id'],
  ['messages',[{conversation_id:fixtureId(10),sender_id:ids.alice,body:"Hello! I'm Alice Test. This is a synthetic message.",client_id:fixtureId(20)},{conversation_id:fixtureId(11),sender_id:ids.ben,body:'Welcome to the staging study group.',client_id:fixtureId(21)}],'sender_id,client_id'],
  ['social_posts',[{id:fixtureId(30),author_id:ids.ben,kind:'post',body:'Synthetic campus post.'},{id:fixtureId(31),author_id:ids.ben,kind:'story',body:'Synthetic story, visible for 24 hours.',created_at:now.toISOString()},{id:fixtureId(32),author_id:ids.outsider,kind:'post',body:'Outsider post: must not appear in Alice feed.'}],'id'],
  ['saved_posts',[{user_id:ids.alice,post_id:fixtureId(30)}],'user_id,post_id'],
  ['book_listings',[{id:fixtureId(40),owner_id:ids.ben,title:'Synthetic Calculus Book',price:20,currency:'EUR',published:true,description:'Test listing. Not for sale.'},{id:fixtureId(41),owner_id:ids.ben,title:'Private draft test',price:10,published:false}],'id'],
  ['campus_events',[{id:fixtureId(50),owner_id:ids.university,title:'Synthetic campus meetup',location:'Test campus',starts_at:future,capacity:2}],'id'],
  ['event_registrations',[{event_id:fixtureId(50),user_id:ids.alice}],'event_id,user_id'],
 ];
}
