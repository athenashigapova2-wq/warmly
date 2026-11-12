import {Market} from './market';
import {Discover} from './discover';
import {MemberProfile} from './member-profile';
import {universityName} from './discover-utils';
import {Events} from './events';
import {AccountRole,RoleChoice,roleLabel} from './roles';
import {Account} from './account';
import {firstHello} from './chat-utils';
import {Social} from './social';
import { Component, inject, signal, ViewChild, ElementRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { MessengerApi, Profile, Chat, Message, Friendship, Membership } from './transport';
import { authFeedback, rememberedEmail, rememberEmail, restoreAuth } from './auth-utils';
@Component({selector:'warmly-app',standalone:true,imports:[FormsModule,DatePipe,Social,Account,Market,Events,Discover,MemberProfile],templateUrl:'./app.html'})
export class App {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  api = inject(MessengerApi);
  viewedProfile=signal('');
  openPerson(id:string){if(!id)return;if(id===this.me()){this.openSection('profile');return;}this.error.set('');this.viewedProfile.set(id);}
  openDirectProfile(){const other=this.chatMembers().find(p=>p.id!==this.me());if(other)this.openPerson(other.id);}
  messageFromProfile(id:string){this.viewedProfile.set('');this.direct(id);}
  stage = signal<'setup'|'auth'|'profile'|'app'>('setup');
  busy = signal(false); sending = signal(false); error = signal(''); notice = signal(''); online = signal(true);
  me = signal(''); profiles = signal<Profile[]>([]); chats = signal<Chat[]>([]);
  friendships = signal<Friendship[]>([]); memberships = signal<Membership[]>([]); messages = signal<Message[]>([]);
  historyLoaded=signal(false); enterToSend=true;
  hello(){return firstHello(this.name,this.active()?.kind,this.historyLoaded(),this.messages().length,this.draft);}
  suggestHello(){const hello=this.hello();if(hello)this.draft=hello;}
  active = signal<Chat|null>(null); view = signal<'home'|'profile'|'chats'|'people'|'group'|'market'|'events'>('home'); details = signal(false);
  results = signal<Profile[]>([]); searched = signal(false); hasOlder = signal(false);
  welcomeSeen=signal(false); showEmail=signal(false); retryIn=signal(0); canResend=signal(false); configLoading=signal(true);
  private cooldownTimer?:ReturnType<typeof setTimeout>;
  private nativeReturn=Promise.resolve();
  url = ''; key = ''; email = ''; password = ''; signup = false; name = ''; username = ''; university='';
  accountRole=signal<AccountRole|null>(null); roleChoice:RoleChoice='student'; institution='';roleLabel=roleLabel;
  persistRoleChoice(){try{sessionStorage.setItem('warmly.role-choice',JSON.stringify({choice:this.roleChoice,institution:this.institution,university:this.university}));}catch{}}
  async readRole(){const {data,error}=await this.api.client.from('account_roles').select('*').eq('user_id',this.me()).maybeSingle();if(error)throw Error('The marketplace update needs its database migration. Please try again after setup.');this.accountRole.set(data);return data;}
  openSection(view:'market'|'events'|'profile'){this.view.set(view);void this.readRole().catch(e=>this.error.set(e.message));}
  marketConversation(id:string){void this.run(async()=>{await this.refresh();const chat=this.chats().find(c=>c.id===id);if(chat)await this.open(chat);});}
  query = ''; groupName = ''; selected: string[] = []; draft = ''; addId = '';
  private timer?: ReturnType<typeof setTimeout>; private epoch = 0; private historyVersion = 0;
  private retry?: {chatId:string; body:string; clientId:string};
  constructor() { void this.initialize(); }
  async initialize() {
    try{const saved=JSON.parse(sessionStorage.getItem('warmly.role-choice')||'null');if(['student','university','visitor'].includes(saved?.choice)){this.roleChoice=saved.choice;this.institution=saved.institution||'';this.university=saved.university||'';}}catch{}
    try {this.enterToSend=localStorage.getItem('warmly.enter-to-send')!=='false';}catch{}
    this.email=rememberedEmail(localStorage);
    if(this.email){this.welcomeSeen.set(true);this.showEmail.set(true);this.signup=false;}
    const until=Number(sessionStorage.getItem('warmly.auth.retry-until') || 0);
    if(until>Date.now())this.cooldown(Math.ceil((until-Date.now())/1000));
    try {
      let config;
      // A bundled project config takes precedence. The cache supports existing test installs.
      try { const r=await fetch('config.json',{cache:'no-store'}); if(r.ok)config=await r.json(); } catch {}
      if(!config)config=JSON.parse(localStorage.getItem('warmly.public-config') || 'null');
      if (config?.url && config?.key) { this.url=config.url; this.key=config.key; await this.connect(); }
    } catch { this.stage.set('setup'); }
    finally {this.configLoading.set(false);}
  }
  async run(task:()=>Promise<void>) {
    if (this.busy()) return; this.busy.set(true); this.error.set(''); this.notice.set('');
    try { await task(); } catch(e) { this.error.set(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { this.busy.set(false); }
  }
  async connect() {
    await this.run(async()=>{
      this.api.configure(this.url.trim(),this.key.trim());
      this.api.client.auth.onAuthStateChange((event)=>{ if (event==='SIGNED_OUT') this.reset(); });
      try {
        const session=await restoreAuth(this.api.client.auth,()=>this.api.finishOAuth(location.href));
        if(session){this.remember(session.user.email);this.me.set(session.user.id);await this.loadAccount();}
        else this.stage.set('auth');
      } catch(error){this.stage.set('auth');this.welcomeSeen.set(true);this.signup=false;throw error;}
    });
    if(this.api.client)await this.api.watchNativeCallback(url=>{
      this.nativeReturn=this.nativeReturn.then(async()=>{
        try {
          if(!await this.api.finishOAuth(url))return;
          const {data}=await this.api.client.auth.getSession();
          if(data.session){this.remember(data.session.user.email);this.me.set(data.session.user.id);await this.loadAccount();this.error.set('');this.notice.set('');}
        }catch(e){this.error.set((e as Error).message);}
      });
    });
  }
  remember(email?:string){if(email){this.email=email;rememberEmail(localStorage,email);}this.welcomeSeen.set(true);this.signup=false;this.canResend.set(false);}
  cooldown(seconds:number) {
    const until=Date.now()+seconds*1000;sessionStorage.setItem('warmly.auth.retry-until',String(until));
    clearTimeout(this.cooldownTimer);
    const tick=()=>{this.retryIn.set(Math.max(0,Math.ceil((until-Date.now())/1000)));if(this.retryIn())this.cooldownTimer=setTimeout(tick,500);else sessionStorage.removeItem('warmly.auth.retry-until');};tick();
  }
  authError(error:any):never {
    const feedback=authFeedback(error);if(feedback.retrySeconds)this.cooldown(feedback.retrySeconds);
    if(error.code==='email_not_confirmed'){this.canResend.set(true);this.signup=false;rememberEmail(localStorage,this.email);}
    throw new Error(feedback.message);
  }
  google() {void this.run(async()=>{
    try {this.persistRoleChoice();await this.api.google();this.notice.set('Finish signing in in your browser, then return to Warmly.');}
    catch(error){this.authError(error);}
  });}
  resend() {if(this.retryIn())return;void this.run(async()=>{
    const {error}=await this.api.client.auth.resend({type:'signup',email:this.email.trim(),options:{emailRedirectTo:this.api.redirectUrl()}});
    if(error)this.authError(error);this.cooldown(60);this.notice.set('If your account needs confirmation, a new email is on its way. Check your inbox and spam folder.');
  });}
  authenticate() { if(this.signup && this.retryIn())return;void this.run(async()=>{
    this.persistRoleChoice();
    const credentials = {email:this.email.trim(),password:this.password};
    rememberEmail(localStorage,credentials.email);this.canResend.set(false);
    const {data,error} = this.signup ? await this.api.client.auth.signUp({...credentials,options:{emailRedirectTo:this.api.redirectUrl()}}) : await this.api.client.auth.signInWithPassword(credentials);
    if (error)this.authError(error); this.password='';
    if (!data.session) { this.cooldown(60);this.canResend.set(true);this.notice.set('If this is a new account, check your email to confirm it once. If you already have an account, sign in below or continue with Google.'); this.signup=false; return; }
    this.remember(data.session.user.email);this.me.set(data.session.user.id); await this.loadAccount();
  }); }
  async loadAccount() {
    const {data,error} = await this.api.client.from('profiles').select('*').eq('id',this.me()).maybeSingle();
    if (error) throw new Error('Apply the messenger migration in Supabase, then sign in again.');
    if (!data) { this.accountRole.set(null);this.stage.set('profile'); return; }
    this.name=data.name; this.username=data.username;this.university=data.university||this.university;
    const role=await this.readRole();
    if(!role||!data.university?.trim()){this.stage.set('profile');return;}
    this.stage.set('app');
    try { await this.refresh(); } finally { this.schedule(); }
  }
  saveProfile() { void this.run(async()=>{
    this.university=universityName(this.university);
    if(!this.university||this.university.length>100)throw Error('Enter your university or the campus you want to connect with (up to 100 characters).');
    await this.api.rpc('profile',{name:this.name,username:this.username});
    const updated=await this.api.client.from('profiles').update({university:this.university}).eq('id',this.me()).select('id');
    if(updated.error)throw updated.error;if(!updated.data?.length)throw Error('Your university was not saved. Please try again.');
    if(!this.accountRole()){const {error}=await this.api.client.rpc('choose_account_role',{choice:this.roleChoice,institution:this.institution});if(error)throw error;}
    try{sessionStorage.removeItem('warmly.role-choice');}catch{} await this.loadAccount();
  }); }
  reset() {
    this.viewedProfile.set('');
    this.accountRole.set(null);this.signup=false;this.canResend.set(false);this.password='';this.university='';this.name='';this.username='';this.welcomeSeen.set(true);this.epoch++; this.historyVersion++; clearTimeout(this.timer); this.active.set(null); this.messages.set([]);
    this.profiles.set([]); this.friendships.set([]); this.chats.set([]); this.memberships.set([]);
    this.results.set([]); this.query=''; this.draft=''; this.retry=undefined; this.selected=[]; this.me.set(''); this.stage.set('auth');this.view.set('home');this.details.set(false);this.searched.set(false);
  }
  logout() { void this.run(async()=>{ const {error}=await this.api.client.auth.signOut({scope:'local'}); if(error) throw error; this.reset(); }); }
  async refresh() {
    const generation=this.epoch;
    const [friends,chats,members] = await Promise.all([this.api.table<Friendship>('friendships'),this.api.table<Chat>('conversations'),this.api.table<Membership>('conversation_members')]);
    const ids = [...new Set([this.me(),...friends.flatMap(f=>[f.sender,f.recipient]),...members.map(m=>m.user_id)])];
    const {data,error}=await this.api.client.from('profiles').select('*').in('id',ids);
    if(error) throw error; if(generation!==this.epoch) return;
    this.profiles.set(data as Profile[]); const own=data.find(p=>p.id===this.me());if(own){this.name=own.name;this.username=own.username;} this.friendships.set(friends); this.memberships.set(members);
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
    if(!chat)return;this.historyVersion++;this.historyLoaded.set(false);this.active.set(chat);this.messages.set([]);this.draft='';this.retry=undefined;this.details.set(false);this.view.set('chats');
    try {await this.history(false,true);}catch(e){this.error.set((e as Error).message);}
  }
  async history(older=false,initial=false) {
    const chat=this.active(); if(!chat)return;const version=this.historyVersion;
    const rows:Message[]=await this.api.rpc('history',{chatId:chat.id,...(older?{before:this.messages()[0]?.id}:{})});
    if(version!==this.historyVersion || this.active()?.id!==chat.id)return;
    this.historyLoaded.set(true);
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
  keydown(e:KeyboardEvent){if(this.enterToSend&&e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();void this.send();}}
  back(){this.active.set(null);this.historyVersion++;this.messages.set([]);this.details.set(false);}
}

