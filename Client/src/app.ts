import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MessengerApi, Profile, Chat, Message, Friendship, Membership } from './transport';
@Component({selector:'warmly-app',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./app.html'})
export class App {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  api = inject(MessengerApi);
  stage = signal<'setup'|'auth'|'profile'|'app'>('setup');
  busy = signal(false); sending = signal(false); error = signal(''); notice = signal(''); online = signal(true);
  me = signal(''); profiles = signal<Profile[]>([]); chats = signal<Chat[]>([]);
  friendships = signal<Friendship[]>([]); memberships = signal<Membership[]>([]); messages = signal<Message[]>([]);
  active = signal<Chat|null>(null); view = signal<'chats'|'people'|'group'>('chats'); details = signal(false);
  results = signal<Profile[]>([]); searched = signal(false); hasOlder = signal(false);
  url = ''; key = ''; email = ''; password = ''; signup = false; name = ''; username = '';
  query = ''; groupName = ''; selected: string[] = []; draft = ''; addId = '';
  private timer?: ReturnType<typeof setTimeout>; private epoch = 0; private historyVersion = 0;
  private retry?: {chatId:string; body:string; clientId:string};
  constructor() { void this.initialize(); }
  async initialize() {
    try {
      let config = JSON.parse(localStorage.getItem('warmly.public-config') || 'null');
      if (!config) { try { const r = await fetch('config.json'); if (r.ok) config = await r.json(); } catch {} }
      if (config?.url && config?.key) { this.url=config.url; this.key=config.key; await this.connect(); }
    } catch { this.stage.set('setup'); }
  }
  async run(task:()=>Promise<void>) {
    if (this.busy()) return; this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await task(); } catch(e) { this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { this.busy.set(false); }
  }
  async connect() {
    await this.run(async()=>{
      this.api.configure(this.url.trim(),this.key.trim()); this.stage.set('auth');
      this.api.client.auth.onAuthStateChange((event)=>{ if (event==='SIGNED_OUT') this.reset(); });
      const {data} = await this.api.client.auth.getSession();
      if (data.session) { this.me.set(data.session.user.id); await this.loadAccount(); }
    });
  }
  authenticate() { void this.run(async()=>{
    const credentials = {email:this.email.trim(),password:this.password};
    const {data,error} = this.signup ? await this.api.client.auth.signUp(credentials) : await this.api.client.auth.signInWithPassword(credentials);
    if (error) throw error; this.password='';
    if (!data.session) { this.notice.set('Check your email to confirm your account, then come back and sign in.'); this.signup=false; return; }
    this.me.set(data.session.user.id); await this.loadAccount();
  }); }
  async loadAccount() {
    const {data,error} = await this.api.client.from('profiles').select('*').eq('id',this.me()).maybeSingle();
    if (error) throw new Error('Apply the messenger migration in Supabase, then sign in again.');
    if (!data) { this.stage.set('profile'); return; }
    this.name=data.name; this.username=data.username; this.stage.set('app');
    try { await this.refresh(); } finally { this.schedule(); }
  }
  saveProfile() { void this.run(async()=>{ await this.api.rpc('profile',{name:this.name,username:this.username}); await this.loadAccount(); }); }
  reset() {
    this.epoch++; this.historyVersion++; clearTimeout(this.timer); this.active.set(null); this.messages.set([]);
    this.profiles.set([]); this.friendships.set([]); this.chats.set([]); this.memberships.set([]);
    this.results.set([]); this.query=''; this.draft=''; this.retry=undefined; this.selected=[]; this.me.set(''); this.stage.set('auth');this.view.set('chats');this.details.set(false);this.searched.set(false);
  }
  logout() { void this.run(async()=>{ const {error}=await this.api.client.auth.signOut({scope:'local'}); if(error) throw error; this.reset(); }); }
  async refresh() {
    const generation=this.epoch;
    const [friends,chats,members] = await Promise.all([this.api.table<Friendship>('friendships'),this.api.table<Chat>('conversations'),this.api.table<Membership>('conversation_members')]);
    const ids = [...new Set([this.me(),...friends.flatMap(f=>[f.sender,f.recipient]),...members.map(m=>m.user_id)])];
    const {data,error}=await this.api.client.from('profiles').select('*').in('id',ids);
    if(error) throw error; if(generation!==this.epoch) return;
    this.profiles.set(data as Profile[]); this.friendships.set(friends); this.memberships.set(members);
    this.chats.set(chats.sort((a,b)=>b.created_at.localeCompare(a.created_at)));
    const active=this.active();
    if(active && !chats.some(c=>c.id===active.id)) {this.active.set(null);this.messages.set([]);this.historyVersion++;}
    if(this.active()) await this.history(false); this.online.set(true);
  }
  schedule() { clearTimeout(this.timer); if(this.stage()!=='app') return; this.timer=setTimeout(async()=>{
    try { await this.refresh(); } catch { this.online.set(false); } this.schedule();
  },2500); }
  person(id:string) { return this.profiles().find(p=>p.id===id) || this.results().find(p=>p.id===id); }
  friends() { return this.friendships().filter(f=>f.status==='accepted').map(f=>this.person(f.sender===this.me()?f.recipient:f.sender)).filter((p):p is Profile=>!!p); }
  incoming() {return this.friendships().filter(f=>f.status==='pending' && f.recipient===this.me());}
  outgoing() {return this.friendships().filter(f=>f.status==='pending' && f.sender===this.me());}
  relation(id:string) {return this.friendships().find(f=>f.sender===id || f.recipient===id);}
  title(chat:Chat) {return chat.kind==='group'?chat.title:this.person(this.memberships().find(m=>m.conversation_id===chat.id && m.user_id!==this.me())?.user_id || '')?.name || 'Direct message';}
  chatMembers() {return this.memberships().filter(m=>m.conversation_id===this.active()?.id).map(m=>this.person(m.user_id)).filter((p):p is Profile=>!!p);}
  availableFriends() {const ids=this.chatMembers().map(p=>p.id);return this.friends().filter(p=>!ids.includes(p.id));}
  search() { void this.run(async()=>{
    const term=this.query.trim().toLowerCase(); if(!/^[a-z0-9_]{2,24}$/.test(term)) throw new Error('Enter at least 2 username characters (letters, numbers or underscores).');
    const {data,error}=await this.api.client.from('profiles').select('*').like('username',term.replace(/_/g,'\\_')+'%').neq('id',this.me()).limit(20);
    if(error) throw error;this.results.set(data as Profile[]);this.searched.set(true);
  }); }
  action(action:string,payload:object) {void this.run(async()=>{await this.api.rpc(action,payload);await this.refresh();});}
  direct(id:string) {void this.run(async()=>{const r=await this.api.rpc('direct',{userId:id});await this.refresh();await this.open(this.chats().find(c=>c.id===r.id)!);});}
  toggle(id:string) {this.selected=this.selected.includes(id)?this.selected.filter(x=>x!==id):[...this.selected,id];}
  createGroup() {void this.run(async()=>{const r=await this.api.rpc('group',{title:this.groupName,members:this.selected});await this.refresh();this.groupName='';this.selected=[];await this.open(this.chats().find(c=>c.id===r.id)!);});}
  async open(chat:Chat) {
    if(!chat)return;this.historyVersion++;this.active.set(chat);this.messages.set([]);this.draft='';this.retry=undefined;this.details.set(false);this.view.set('chats');
    try {await this.history(false,true);}catch(e){this.error.set((e as Error).message);}
  }
  async history(older=false,initial=false) {
    const chat=this.active(); if(!chat)return;const version=this.historyVersion;
    const rows:Message[]=await this.api.rpc('history',{chatId:chat.id,...(older?{before:this.messages()[0]?.id}:{})});
    if(version!==this.historyVersion || this.active()?.id!==chat.id)return;
    const el=this.timeline?.nativeElement;const stick=initial || (!!el && el.scrollHeight-el.scrollTop-el.clientHeight<90);
    const oldHeight=el?.scrollHeight || 0;const oldTop=el?.scrollTop || 0;
    this.messages.update(items=>[...new Map([...items,...rows].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id));
    if(older || initial)this.hasOlder.set(rows.length===50);
    setTimeout(()=>{if(version!==this.historyVersion)return;const target=this.timeline?.nativeElement;if(target){if(older)target.scrollTop=oldTop+target.scrollHeight-oldHeight;else if(stick)target.scrollTop=target.scrollHeight;}});
  }
  older() {void this.run(()=>this.history(true));}
  async send() {
    const chat=this.active();const body=this.draft.trim();if(!chat || !body || this.sending())return;
    const version=this.historyVersion;this.sending.set(true);this.error.set('');
    if(!this.retry || this.retry.chatId!==chat.id || this.retry.body!==body)this.retry={chatId:chat.id,body,clientId:crypto.randomUUID()};
    try {const row:Message=await this.api.rpc('send',this.retry);
      if(version!==this.historyVersion)return;
      this.messages.update(items=>[...new Map([...items,row].map(m=>[m.id,m])).values()].sort((a,b)=>a.id-b.id));
      if(this.draft.trim()===body)this.draft='';this.retry=undefined;this.online.set(true);
      setTimeout(()=>{const el=this.timeline?.nativeElement;if(el)el.scrollTop=el.scrollHeight;});
    }catch(e){this.error.set((e as Error).message);}finally{this.sending.set(false);}
  }
  keydown(e:KeyboardEvent){if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void this.send();}}
  back(){this.active.set(null);this.historyVersion++;this.messages.set([]);this.details.set(false);}
}

