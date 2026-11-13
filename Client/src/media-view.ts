import {Component,inject,input,signal,effect,OnDestroy} from '@angular/core';
import {MessengerApi} from './transport';
@Component({selector:'warmly-media',standalone:true,template:`
 @if(url()){ @if(type()==='video'){<video [src]="url()" controls playsinline preload="metadata" (error)="failed.set(true)"></video>}@else{<img [src]="url()" [alt]="alt()" loading="lazy" (error)="failed.set(true)">} }
 @if(failed()){@if(compact()){<span>{{fallback()}}</span>}@else{<span class="muted">Media unavailable <button type="button" class="text-button" (click)="load()">Retry</button></span>}}
 `,styles:[`:host{display:block}img,video{display:block;width:100%;max-height:520px;object-fit:contain;border-radius:16px} :host.avatar-media img{width:100%;height:100%;object-fit:cover;border-radius:inherit}`]})
export class MediaView implements OnDestroy {
 api=inject(MessengerApi);path=input('');bucket=input('warmly-social');type=input('image');alt=input('Shared photo');compact=input(false);fallback=input('?');url=signal('');failed=signal(false);private generation=0;private timer?:ReturnType<typeof setTimeout>;
 constructor(){effect(()=>{this.path();this.bucket();void this.load();});}
 async load(){const generation=++this.generation;clearTimeout(this.timer);this.failed.set(false);this.url.set('');if(!this.path())return;
 try{const {data,error}=await this.api.client.storage.from(this.bucket()).createSignedUrl(this.path(),300);if(error)throw error;if(generation!==this.generation)return;this.url.set(data.signedUrl);this.timer=setTimeout(()=>void this.load(),240000);}catch{if(generation===this.generation)this.failed.set(true);}}
 ngOnDestroy(){this.generation++;clearTimeout(this.timer);}
}
