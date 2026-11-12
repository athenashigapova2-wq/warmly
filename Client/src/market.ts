import {Component,inject,input,output,signal,OnInit} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MessengerApi} from './transport';
import {AccountRole,canSell} from './roles';
import {photoData} from './photo';
const fresh=()=>({id:crypto.randomUUID(),title:'',author:'',price:0,currency:'SEK',condition:'Good',description:'',status:'available',category:'Books',image:'',published:true});
@Component({selector:'warmly-market',standalone:true,imports:[FormsModule],templateUrl:'./market.html'})
export class Market implements OnInit {
 api=inject(MessengerApi);me=input.required<string>();role=input<AccountRole|null>(null);mineOnly=input(false);sellerChat=output<string>();
 rows=signal<any[]>([]);detail=signal<any>(null);seller=signal<any>(null);editing=signal(false);busy=signal(false);loading=signal(false);error=signal('');notice=signal('');more=signal(false);own=signal(false);query='';category='All';categories=['All','Books','Notes','Electronics','Other'];form=fresh();existing=false;private request=0;
 ngOnInit(){this.own.set(this.mineOnly());void this.load();} canSell(){return canSell(this.role());}
 async load(older=false){if(this.loading()&&older)return;const request=++this.request;this.loading.set(true);this.error.set('');try{
 const offset=older?this.rows().length:0;let q=this.api.client.from('book_listings').select('*').order('created_at',{ascending:false}).order('id',{ascending:false});
 if(this.own())q=q.eq('owner_id',this.me());else q=q.eq('published',true).eq('status','available');
 if(this.category!=='All')q=q.eq('category',this.category);const term=this.query.trim().replace(/[%_]/g,'').split(String.fromCharCode(92)).join('');if(term)q=q.ilike('title','%'+term+'%');
 const {data,error}=await q.range(offset,offset+19);if(error)throw error;if(request!==this.request)return;this.rows.set(older?[...this.rows(),...data]:data);this.more.set(data.length===20);
 }catch{if(request===this.request)this.error.set('Could not load the marketplace. Check your connection and try Refresh.');}finally{if(request===this.request)this.loading.set(false);}}
 async show(row:any){this.detail.set(row);this.seller.set(null);this.error.set('');const {data,error}=await this.api.client.from('profiles').select('id,name,university').eq('id',row.owner_id).maybeSingle();if(this.detail()?.id===row.id){if(error)this.error.set('Seller details could not be loaded.');else this.seller.set(data);}}
 create(){if(!this.canSell())return;this.form=fresh();this.existing=false;this.editing.set(true);this.detail.set(null);this.error.set('');}
 edit(row:any){this.form={...row};this.existing=true;this.editing.set(true);this.detail.set(null);}
 async photo(event:Event){const el=event.target as HTMLInputElement;const file=el.files?.[0];if(!file)return;this.busy.set(true);try{this.form.image=await photoData(file);}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);el.value='';}}
 async save(){if(this.busy()||!this.canSell())return;this.busy.set(true);this.error.set('');try{const {id,title,author,price,currency,condition,description,status,category,image,published}=this.form;const fields={title:title.trim(),author:author.trim(),price,currency,condition,description:description.trim(),status,category,image,published};const result=this.existing?await this.api.client.from('book_listings').update(fields).eq('id',id).eq('owner_id',this.me()).select('id'):await this.api.client.from('book_listings').insert({id,...fields}).select('id');if(result.error)throw result.error;if(!result.data?.length)throw Error('Access changed.');this.editing.set(false);this.own.set(true);this.notice.set(published?'Listing saved. Available items are visible in Marketplace.':'Draft saved privately.');await this.load();}catch(e){this.error.set('Could not save. Check the fields and your account permissions, then try again.');}finally{this.busy.set(false);}}
 async remove(row:any){if(this.busy())return;this.busy.set(true);try{const {error}=await this.api.client.from('book_listings').delete().eq('id',row.id).eq('owner_id',this.me());if(error)throw error;this.detail.set(null);await this.load();}catch{this.error.set('Could not delete this listing.');}finally{this.busy.set(false);}}
 async message(){const row=this.detail();if(!row||this.busy())return;this.busy.set(true);this.error.set('');try{const {data,error}=await this.api.client.rpc('market_chat',{item_id:row.id});if(error)throw error;this.sellerChat.emit(data);}catch(e){this.error.set((e as Error).message);}finally{this.busy.set(false);}}
}
