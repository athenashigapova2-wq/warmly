import {Avatar} from './avatar';
import {MediaView} from './media-view';
import {PostActivity,Activity} from './post-activity';
import {prepareMedia,uploadMedia} from './media';
import {universityName} from './discover-utils';
import {Component,inject,input,output,signal,OnInit,OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {MessengerApi,Profile} from './transport';
interface Post {id:string;author_id:string;kind:string;body:string;image:string;created_at:string;media_path?:string;media_type?:string}
@Component({selector:'warmly-social',standalone:true,imports:[FormsModule,DatePipe,Avatar,MediaView,PostActivity],templateUrl:'./social.html'})
export class Social implements OnInit,OnDestroy {
 api=inject(MessengerApi); me=input.required<string>(); mode=input<'home'|'profile'>('home'); profiles=input<Profile[]>([]); saved=output<void>(); viewProfile=output<string>();
 posts=signal<Post[]>([]); stories=signal<Post[]>([]); viewer=signal<Post|null>(null); error=signal(''); notice=signal(''); busy=signal(false); loading=signal(true); more=signal(false);
 body='';image='';kind='post';editing=false; form={name:'',username:'',university:'',program:'',bio:'',interests:''}; private alive=true;private timer?:ReturnType<typeof setTimeout>;private pendingId=''; media:Awaited<ReturnType<typeof prepareMedia>>|null=null;preview='';private uploadedPath='';activity=signal<Activity[]>([]);
 summary(id:string){return this.activity().find(a=>a.post_id===id);}
 clearMedia(){if(this.preview)URL.revokeObjectURL(this.preview);this.preview='';this.media=null;this.uploadedPath='';}
 async attachment(event:Event){const input=event.target as HTMLInputElement;const file=input.files?.[0];if(!file)return;this.busy.set(true);this.error.set('');try{const media=await prepareMedia(file);this.clearMedia();this.media=media;this.preview=URL.createObjectURL(media.blob);}catch(e){this.error.set((e as Error).message);}finally{input.value='';this.busy.set(false);}}
 async avatar(event:Event){const el=event.target as HTMLInputElement;const file=el.files?.[0];if(!file)return;this.busy.set(true);this.error.set('');try{const media=await prepareMedia(file,true);const path=await uploadMedia(this.api.client,this.me(),media,true);const {error}=await this.api.client.from('profiles').update({avatar_path:path}).eq('id',this.me());if(error)throw error;this.saved.emit();this.notice.set('Profile photo updated.');}catch(e){this.error.set((e as Error).message);}finally{el.value='';this.busy.set(false);}}
 async removeAvatar(){this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.from('profiles').update({avatar_path:''}).eq('id',this.me());if(error)throw error;this.saved.emit();}catch{this.error.set('Could not remove photo.');}finally{this.busy.set(false);}}
 ngOnInit(){void this.load();this.tick();}
 ngOnDestroy(){this.clearMedia();this.alive=false;clearTimeout(this.timer);}
 tick(){this.timer=setTimeout(()=>{if(!this.alive)return;this.stories.update(rows=>rows.filter(p=>Date.parse(p.created_at)>Date.now()-86400000));if(this.viewer()&&!this.stories().some(p=>p.id===this.viewer()?.id))this.viewer.set(null);this.tick();},15000);}
 person(id:string){return this.profiles().find(p=>p.id===id);}
 async load(older=false){this.error.set('');this.loading.set(true);try {
 let query=this.api.client.from('social_posts').select('*').eq('kind','post').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20);
 const last=this.posts().at(-1);if(older&&last)query=query.or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`);
 const {data,error}=await query;if(error)throw error;if(!this.alive)return;
 this.posts.set(older?[...this.posts(),...data]:data);this.more.set(data.length===20);
 if(!older){const r=await this.api.client.from('social_posts').select('*').eq('kind','story').gt('created_at',new Date(Date.now()-86400000).toISOString()).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;if(this.alive)this.stories.set(r.data);}
 const ids=[...this.posts(),...this.stories()].map(p=>p.id);const summaries:Activity[]=[];for(let i=0;i<ids.length;i+=100){const a=await this.api.client.rpc('social_activity',{targets:ids.slice(i,i+100)});if(a.error)throw a.error;summaries.push(...(a.data||[]));}if(this.alive)this.activity.set(summaries);
 }catch(e){if(this.alive)this.error.set('Could not load your feed. Check your connection and make sure the social migration has been applied.');}finally{if(this.alive)this.loading.set(false);}}
 async publish(){if(this.busy()||(!this.body.trim()&&!this.image&&!this.media))return;this.busy.set(true);this.error.set('');this.notice.set('');this.pendingId ||= crypto.randomUUID();try{
 if(this.media&&!this.uploadedPath)this.uploadedPath=await uploadMedia(this.api.client,this.me(),this.media);
 const {error}=await this.api.client.from('social_posts').insert({id:this.pendingId,kind:this.kind,body:this.body.trim(),image:this.image,media_path:this.uploadedPath,media_type:this.media?.type||''});if(error&&error.code!=='23505')throw error;
 this.pendingId='';this.clearMedia();this.body='';this.image='';this.notice.set(this.kind==='story'?'Story shared for 24 hours.':'Post shared with your contacts.');await this.load();
 }catch(e){this.error.set('Could not publish. Your draft is saved here; please try again.');}finally{this.busy.set(false);}}
 async remove(p:Post){if(this.busy())return;this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.from('social_posts').delete().eq('id',p.id).eq('author_id',this.me());if(error)throw error;this.viewer.set(null);await this.load();}catch{this.error.set('Could not delete. Please try again.');}finally{this.busy.set(false);}}
 async bookmark(p:Post){if(this.busy())return;this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.from('saved_posts').insert({post_id:p.id});if(error&&error.code!=='23505')throw error;this.notice.set('Saved. Find this post in Profile → Saved Items.');}catch{this.error.set('Could not save. Apply the account migration and try again.');}finally{this.busy.set(false);}}
 edit(){const p=this.person(this.me()) as any;for(const key of Object.keys(this.form)) (this.form as any)[key]=p?.[key]||'';this.editing=true;}
 async save(){if(this.busy())return;this.form.university=universityName(this.form.university);if(!this.form.university){this.error.set('Enter your university or the campus you want to connect with.');return;}this.busy.set(true);this.error.set('');try{const fields=Object.fromEntries(Object.entries(this.form).map(([k,v])=>[k,v.trim()]));const {data,error}=await this.api.client.from('profiles').update(fields).eq('id',this.me()).select('id');if(error)throw error;if(!data?.length)throw Error('Profile was not saved.');this.editing=false;this.notice.set('Profile updated.');this.saved.emit();}catch(e){this.error.set((e as any).code==='23505'?'That username is already taken.':'Could not save your profile. Check the fields and try again.');}finally{this.busy.set(false);}}
}
