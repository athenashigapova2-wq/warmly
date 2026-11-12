import {Market} from './market';
import {AccountRole,roleLabel} from './roles';
import {Component,inject,input,output,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {MessengerApi,Profile,Chat} from './transport';
import {Social} from './social';
@Component({selector:'warmly-account',standalone:true,imports:[FormsModule,DatePipe,Social,Market],templateUrl:'./account.html'})
export class Account {
 role=input<AccountRole|null>(null);sellerChat=output<string>();roleLabel=roleLabel;
 api=inject(MessengerApi);me=input.required<string>();email=input('');profiles=input<Profile[]>([]);groups=input<Chat[]>([]);
 saved=output<void>();openGroup=output<Chat>();newGroup=output<void>();signout=output<void>();enterChanged=output<boolean>();
 section=signal('menu');rows=signal<any[]>([]);busy=signal(false);error=signal('');notice=signal('');more=signal(false);editing=signal(false);enter=true;remember=true;
 options=[['profile','♙','My Profile'],['posts','▤','My Posts'],['books','▥','My Listings'],['saved','♧','Saved Items'],['groups','♧','My Groups'],['settings','⚙','Settings'],['help','?','Help & Support']];
 constructor(){try{this.enter=localStorage.getItem('warmly.enter-to-send')!=='false';this.remember=localStorage.getItem('warmly.remember-email')!=='false';}catch{}}
 person(){return this.profiles().find(p=>p.id===this.me());}
 groupList(){return this.groups().filter(g=>g.kind==='group');}
 label(){return this.options.find(o=>o[0]===this.section())?.[2]||'My account';}
 async go(section:string){if(this.busy())return;this.section.set(section);this.rows.set([]);this.error.set('');this.notice.set('');this.editing.set(false);this.more.set(false);if(['posts','saved'].includes(section))await this.load();}
 async load(older=false){if(this.busy())return;this.busy.set(true);const section=this.section();try{
 const offset=older?this.rows().length:0;let q:any;
 if(section==='posts')q=this.api.client.from('social_posts').select('*').eq('author_id',this.me()).eq('kind','post').order('created_at',{ascending:false}).order('id',{ascending:false});
 else if(section==='saved')q=this.api.client.from('saved_posts').select('post_id,created_at,social_posts(*)').eq('user_id',this.me()).order('created_at',{ascending:false}).order('post_id',{ascending:false});
 else q=this.api.client.from('book_listings').select('*').eq('owner_id',this.me()).order('created_at',{ascending:false}).order('id',{ascending:false});
 const {data,error}=await q.range(offset,offset+19);if(error)throw error;if(this.section()!==section)return;this.rows.set(older?[...this.rows(),...data]:data);this.more.set(data.length===20);
 }catch{this.error.set('Could not load this section. Check your connection and apply the account migration if needed.');}finally{this.busy.set(false);}}
 async remove(table:string,id:string){if(this.busy())return;this.busy.set(true);this.error.set('');try{const column=table==='saved_posts'?'post_id':'id';const {error}=await this.api.client.from(table).delete().eq(column,id);if(error)throw error;}catch{this.error.set('Could not remove this item. Please try again.');}finally{this.busy.set(false);}if(!this.error())await this.load();}
 settings(){try{localStorage.setItem('warmly.enter-to-send',String(this.enter));localStorage.setItem('warmly.remember-email',String(this.remember));if(!this.remember)localStorage.removeItem('warmly.auth.email');else if(this.email())localStorage.setItem('warmly.auth.email',this.email());this.enterChanged.emit(this.enter);this.notice.set('Preferences saved on this device.');}catch{this.error.set('This browser is blocking saved preferences.');}}
}
