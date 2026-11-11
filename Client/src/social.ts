import {Component,inject,input,output,signal,OnInit,OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {MessengerApi,Profile} from './transport';
interface Post {id:string;author_id:string;kind:string;body:string;image:string;created_at:string}
@Component({selector:'warmly-social',standalone:true,imports:[FormsModule,DatePipe],templateUrl:'./social.html'})
export class Social implements OnInit,OnDestroy {
 api=inject(MessengerApi); me=input.required<string>(); mode=input<'home'|'profile'>('home'); profiles=input<Profile[]>([]); saved=output<void>();
 posts=signal<Post[]>([]); stories=signal<Post[]>([]); viewer=signal<Post|null>(null); error=signal(''); notice=signal(''); busy=signal(false); loading=signal(true); more=signal(false);
 body='';image='';kind='post';editing=false; form={name:'',username:'',university:'',program:'',bio:'',interests:''}; private alive=true;private timer?:ReturnType<typeof setTimeout>;private pendingId='';
 ngOnInit(){void this.load();this.tick();}
 ngOnDestroy(){this.alive=false;clearTimeout(this.timer);}
 tick(){this.timer=setTimeout(()=>{if(!this.alive)return;this.stories.update(rows=>rows.filter(p=>Date.parse(p.created_at)>Date.now()-86400000));if(this.viewer()&&!this.stories().some(p=>p.id===this.viewer()?.id))this.viewer.set(null);this.tick();},15000);}
 person(id:string){return this.profiles().find(p=>p.id===id);}
 async load(older=false){this.error.set('');this.loading.set(true);try {
 let query=this.api.client.from('social_posts').select('*').eq('kind','post').order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20);
 const last=this.posts().at(-1);if(older&&last)query=query.or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`);
 const {data,error}=await query;if(error)throw error;if(!this.alive)return;
 this.posts.set(older?[...this.posts(),...data]:data);this.more.set(data.length===20);
 if(!older){const r=await this.api.client.from('social_posts').select('*').eq('kind','story').gt('created_at',new Date(Date.now()-86400000).toISOString()).order('created_at',{ascending:false}).limit(100);if(r.error)throw r.error;if(this.alive)this.stories.set(r.data);}
 }catch(e){if(this.alive)this.error.set('Could not load your feed. Check your connection and make sure the social migration has been applied.');}finally{if(this.alive)this.loading.set(false);}}
 async photo(event:Event){const el=event.target as HTMLInputElement;const file=el.files?.[0];if(!file)return;this.busy.set(true);this.error.set('');try{
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024)throw Error('Choose a JPG, PNG or WebP photo under 10 MB.');
 const bitmap=await createImageBitmap(file);const scale=Math.min(1,800/Math.max(bitmap.width,bitmap.height));const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*scale);canvas.height=Math.round(bitmap.height*scale);const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();let quality=.8;let result=canvas.toDataURL('image/jpeg',quality);while(result.length>220000&&quality>.2){quality-=.1;result=canvas.toDataURL('image/jpeg',quality);}if(result.length>220000)throw Error('This photo is too detailed. Please choose a smaller image.');this.image=result;
 }catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);el.value='';}}
 async publish(){if(this.busy()||(!this.body.trim()&&!this.image))return;this.busy.set(true);this.error.set('');this.notice.set('');this.pendingId ||= crypto.randomUUID();try{
 const {error}=await this.api.client.from('social_posts').insert({id:this.pendingId,kind:this.kind,body:this.body.trim(),image:this.image});if(error&&error.code!=='23505')throw error;
 this.pendingId='';this.body='';this.image='';this.notice.set(this.kind==='story'?'Story shared for 24 hours.':'Post shared with your contacts.');await this.load();
 }catch(e){this.error.set('Could not publish. Your draft is saved here; please try again.');}finally{this.busy.set(false);}}
 async remove(p:Post){if(this.busy())return;this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.from('social_posts').delete().eq('id',p.id).eq('author_id',this.me());if(error)throw error;this.viewer.set(null);await this.load();}catch{this.error.set('Could not delete. Please try again.');}finally{this.busy.set(false);}}
 edit(){const p=this.person(this.me()) as any;for(const key of Object.keys(this.form)) (this.form as any)[key]=p?.[key]||'';this.editing=true;}
 async save(){if(this.busy())return;this.busy.set(true);this.error.set('');try{const fields=Object.fromEntries(Object.entries(this.form).map(([k,v])=>[k,v.trim()]));const {data,error}=await this.api.client.from('profiles').update(fields).eq('id',this.me()).select('id');if(error)throw error;if(!data?.length)throw Error('Profile was not saved.');this.editing=false;this.notice.set('Profile updated.');this.saved.emit();}catch(e){this.error.set((e as any).code==='23505'?'That username is already taken.':'Could not save your profile. Check the fields and try again.');}finally{this.busy.set(false);}}
}
