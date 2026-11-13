import {Avatar} from './avatar';
import {Component,inject,input,output,signal,OnInit,OnDestroy} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MessengerApi,Profile,Friendship} from './transport';
import {literalLike,universityOptions} from './discover-utils';
@Component({selector:'warmly-discover',standalone:true,imports:[Avatar,FormsModule],templateUrl:'./discover.html'})
export class Discover implements OnInit,OnDestroy {
 api=inject(MessengerApi);me=input.required<string>();friendships=input<Friendship[]>([]);working=input(false);
 request=output<string>();message=output<string>();accept=output<string>();viewProfile=output<string>();
 universities=signal<string[]>([]);selected=signal('');people=signal<Profile[]>([]);
 loading=signal(false);directoryLoading=signal(false);more=signal(false);moreUniversities=signal(false);error=signal('');directoryError=signal('');
 campusQuery='';usernameQuery='';private campusOffset=0;private peopleOffset=0;private generation=0;private directoryGeneration=0;private alive=true;
 ngOnInit(){void this.loadUniversities();void this.loadPeople();}
 ngOnDestroy(){this.alive=false;this.generation++;this.directoryGeneration++;}
 relation(id:string){return this.friendships().find(f=>f.sender===id||f.recipient===id);}
 async loadUniversities(append=false){
  const generation=++this.directoryGeneration;this.directoryLoading.set(true);this.directoryError.set('');
  const offset=append?this.campusOffset:0;
  try{let q=this.api.client.from('profiles').select('university,id').neq('university','').order('university').order('id');
   if(this.campusQuery.trim())q=q.ilike('university','%'+literalLike(this.campusQuery.trim())+'%');
   const {data,error}=await q.range(offset,offset+199);if(error)throw error;
   if(!this.alive||generation!==this.directoryGeneration)return;
   this.universities.set(universityOptions([...(append?this.universities():[]),...data.map(p=>p.university)]));
   this.campusOffset=offset+data.length;this.moreUniversities.set(data.length===200);
  }catch{if(this.alive&&generation===this.directoryGeneration)this.directoryError.set('Could not load universities. Please try again.');}
  finally{if(this.alive&&generation===this.directoryGeneration)this.directoryLoading.set(false);}
 }
 choose(campus:string){this.selected.set(campus);this.usernameQuery='';void this.loadPeople();}
 async loadPeople(append=false){
  const generation=++this.generation;this.loading.set(true);this.error.set('');const offset=append?this.peopleOffset:0;
  if(!append)this.people.set([]);
  try{let q=this.api.client.from('profiles').select('id,name,username,university,program,avatar_path').neq('id',this.me()).order('username');
   if(this.selected())q=q.ilike('university',literalLike(this.selected()));
   if(this.usernameQuery.trim())q=q.ilike('username','%'+literalLike(this.usernameQuery.trim().replace(/^@/,''))+'%');
   const {data,error}=await q.range(offset,offset+19);if(error)throw error;
   if(!this.alive||generation!==this.generation)return;
   this.people.set(append?[...this.people(),...data]:data);this.peopleOffset=offset+data.length;this.more.set(data.length===20);
  }catch{if(this.alive&&generation===this.generation)this.error.set('Could not load people. Please try again.');}
  finally{if(this.alive&&generation===this.generation)this.loading.set(false);}
 }
}
