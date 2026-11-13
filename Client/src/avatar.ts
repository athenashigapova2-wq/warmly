import {Component,input} from '@angular/core';
import {Profile} from './transport';
import {MediaView} from './media-view';
@Component({selector:'warmly-avatar',standalone:true,imports:[MediaView],template:`@if(person()?.avatar_path){<warmly-media class="avatar-media" [compact]="true" [fallback]="person()?.name?.[0] || '?'" [path]="person()!.avatar_path!" bucket="warmly-avatars" [alt]="person()?.name || 'Profile photo'"/>}@else{<span>{{person()?.name?.[0] || '?'}}</span>}`,styles:[`:host{display:inline-flex;width:42px;height:42px;flex-shrink:0;border-radius:50%;overflow:hidden;background:#eee7ff;color:#6a42ce;align-items:center;justify-content:center;font-weight:700}warmly-media{width:100%;height:100%}`]})
export class Avatar {person=input<Profile|undefined|null>();}
