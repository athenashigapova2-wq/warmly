import {Component,inject,input,signal,OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {MessengerApi} from './transport';
import {AccountRole,effectiveRole} from './roles';
import {photoData} from './photo';
export function localDateTime(iso:string){const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
const fresh=()=>({id:crypto.randomUUID(),title:'',description:'',location:'',starts_at:'',capacity:null as number|null,image:'',status:'scheduled'});
@Component({selector:'warmly-events',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./events.html'})
export class Events implements OnInit {
 api=inject(MessengerApi);me=input.required<string>();role=input<AccountRole|null>(null);rows=signal<any[]>([]);registrations=signal<string[]>([]);detail=signal<any>(null);host=signal<any>(null);attendees=signal<any[]>([]);editing=signal(false);busy=signal(false);loading=signal(false);error=signal('');notice=signal('');more=signal(false);tab='upcoming';form=fresh();existing=false;private request=0;
 canCreate(){return effectiveRole(this.role())==='university';} future(event:any){return Date.parse(event.starts_at)>Date.now();} ngOnInit(){void this.load();}
 async load(older=false){const request=++this.request;this.loading.set(true);this.error.set('');try{
 const offset=older?this.rows().length:0;
 const registrations=await this.api.client.from('event_registrations').select('event_id').eq('user_id',this.me());if(registrations.error)throw registrations.error;
 if(request!==this.request)return;this.registrations.set(registrations.data.map(r=>r.event_id));
 let q=this.api.client.from('campus_events').select('*').order('starts_at',{ascending:this.tab==='upcoming'}).order('id',{ascending:false});
 if(this.tab==='upcoming')q=q.eq('status','scheduled').gt('starts_at',new Date().toISOString());
 else if(this.tab==='hosting')q=q.eq('owner_id',this.me());
 else {if(!this.registrations().length){this.rows.set([]);this.more.set(false);return;}q=q.in('id',this.registrations());}
 const {data,error}=await q.range(offset,offset+19);if(error)throw error;if(request!==this.request)return;this.rows.set(older?[...this.rows(),...data]:data);this.more.set(data.length===20);
 }catch{if(request===this.request)this.error.set('Could not load events. Check your connection and try Refresh.');}finally{if(request===this.request)this.loading.set(false);}}
 async show(event:any){this.detail.set(event);this.host.set(null);this.attendees.set([]);this.error.set('');const {data,error}=await this.api.client.from('profiles').select('name,university').eq('id',event.owner_id).maybeSingle();if(this.detail()?.id!==event.id)return;if(error)this.error.set('Could not load the organizer.');else this.host.set(data);
 if(event.owner_id===this.me())await this.loadAttendees(event.id);}
 async loadAttendees(id:string){const {data,error}=await this.api.client.from('event_registrations').select('user_id,profiles(name,username)').eq('event_id',id).order('created_at').limit(200);if(this.detail()?.id!==id)return;if(error)this.error.set('Could not load attendees.');else this.attendees.set(data);}
 create(){if(!this.canCreate())return;this.form=fresh();this.existing=false;this.editing.set(true);this.detail.set(null);this.error.set('');}
 edit(event:any){this.form={...event,starts_at:localDateTime(event.starts_at)};this.existing=true;this.editing.set(true);this.detail.set(null);}
 async photo(event:Event){const el=event.target as HTMLInputElement;const file=el.files?.[0];if(!file)return;this.busy.set(true);try{this.form.image=await photoData(file);}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);el.value='';}}
 async save(){if(this.busy()||!this.canCreate())return;this.busy.set(true);this.error.set('');try{const {id,title,description,location,starts_at,capacity,image}=this.form;const date=new Date(starts_at);if(!starts_at||!Number.isFinite(date.getTime()))throw Error('Choose an event date.');const fields={title:title.trim(),description:description.trim(),location:location.trim(),starts_at:date.toISOString(),capacity:capacity||null,image};const r=this.existing?await this.api.client.from('campus_events').update(fields).eq('id',id).eq('owner_id',this.me()).select('id'):await this.api.client.from('campus_events').insert({id,...fields}).select('id');if(r.error)throw r.error;if(!r.data?.length)throw Error('Your event publishing permission has changed.');this.editing.set(false);this.tab='hosting';this.notice.set('Event saved. Dates are displayed in each viewer’s local time.');await this.load();}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
 async register(){const event=this.detail();if(!event||this.busy())return;this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.rpc('register_event',{target:event.id});if(error)throw error;this.notice.set('You are registered. Find this event in My Events.');await this.load();if(event.owner_id===this.me())await this.loadAttendees(event.id);}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
 async cancelRegistration(){const event=this.detail();if(!event||this.busy())return;this.busy.set(true);try{const {error}=await this.api.client.from('event_registrations').delete().eq('event_id',event.id).eq('user_id',this.me());if(error)throw error;this.notice.set('Registration cancelled.');await this.load();if(event.owner_id===this.me())await this.loadAttendees(event.id);}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
 async cancelEvent(){const event=this.detail();if(!event||this.busy())return;this.busy.set(true);this.error.set('');try{const {data,error}=await this.api.client.from('campus_events').update({status:'cancelled'}).eq('id',event.id).eq('owner_id',this.me()).select('id');if(error)throw error;if(!data?.length)throw Error('Your event publishing permission has changed.');this.detail.set({...event,status:'cancelled'});this.notice.set('Event cancelled. Registered attendees can see its cancelled status in My Events.');await this.load();}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
}
