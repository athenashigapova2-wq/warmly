import {Component,inject,input,output,signal,ViewChild,ElementRef,OnInit,AfterViewInit,OnDestroy} from '@angular/core';
import {MessengerApi,Profile,Friendship} from './transport';
@Component({selector:'warmly-member-profile',standalone:true,templateUrl:'./member-profile.html'})
export class MemberProfile implements OnInit,AfterViewInit,OnDestroy {
 api=inject(MessengerApi);userId=input.required<string>();me=input.required<string>();friendships=input<Friendship[]>([]);working=input(false);actionError=input('');
 dismiss=output<void>();request=output<string>();accept=output<string>();message=output<string>();
 @ViewChild('dialog') dialog!:ElementRef<HTMLDialogElement>;
 profile=signal<Profile|null>(null);loading=signal(true);error=signal('');private alive=true;private previousOverflow='';private previousFocus:HTMLElement|null=null;
 ngOnInit(){void this.load();}
 ngAfterViewInit(){this.previousFocus=document.activeElement as HTMLElement;this.previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';this.dialog.nativeElement.showModal();}
 ngOnDestroy(){this.alive=false;this.dialog.nativeElement.close();document.body.style.overflow=this.previousOverflow;if(this.previousFocus?.isConnected)this.previousFocus.focus();}
 relation(){return this.friendships().find(f=>f.sender===this.userId()||f.recipient===this.userId());}
 interests(){return (this.profile()?.interests||'').split(/[,;\n]/).map(s=>s.trim()).filter(Boolean);}
 async load(){this.loading.set(true);this.error.set('');try{
  const {data,error}=await this.api.client.from('profiles').select('id,name,username,university,program,bio,interests').eq('id',this.userId()).maybeSingle();
  if(error)throw error;if(!this.alive)return;
  this.profile.set(data);if(!data)this.error.set('This profile is no longer available.');
 }catch{if(this.alive)this.error.set('Could not load this profile. Please try again.');}
 finally{if(this.alive)this.loading.set(false);}}
 backdrop(event:MouseEvent){if(event.target===this.dialog.nativeElement)this.dismiss.emit();}
}
