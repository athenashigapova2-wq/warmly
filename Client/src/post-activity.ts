import {Component,inject,input,signal} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {DatePipe} from '@angular/common';
import {MessengerApi,Profile} from './transport';
export interface Activity {post_id:string;hearts:number;thumbs:number;comments:number;mine:string|null}
@Component({selector:'warmly-post-activity',standalone:true,imports:[FormsModule,DatePipe],template:`
 <div class="reaction-bar"><button type="button" [attr.aria-pressed]="current()?.mine==='heart'" [disabled]="busy()" (click)="react('heart')">♡ Heart · {{current()?.hearts || 0}}</button><button type="button" [attr.aria-pressed]="current()?.mine==='thumb'" [disabled]="busy()" (click)="react('thumb')">👍 Like · {{current()?.thumbs || 0}}</button><button type="button" (click)="toggle()" [attr.aria-expanded]="expanded()">Comments · {{current()?.comments || 0}}</button></div>
 @if(error()){<p class="error" role="alert">{{error()}}</p>}
 @if(expanded()){<section class="comments-section" aria-label="Comments">
 @if(loading()){<p role="status">Loading comments…</p>}
 @for(c of comments();track c.id){<article class="comment"><div><strong>{{c.profiles?.name || name(c.author_id)}}</strong><time>{{c.created_at | date:'MMM d, HH:mm'}}</time></div><p class="post-text">{{c.body}}</p>@if(c.author_id===me() || owner()===me()){<button type="button" class="text-button" (click)="remove(c.id)" [disabled]="busy()">Delete comment</button>}</article>}
 @if(!comments().length&&!loading()){<p class="muted">Start a conversation.</p>}
 @if(more()){<button type="button" class="text-button" (click)="load(true)" [disabled]="loading()">Older comments</button>}
 <form (ngSubmit)="send()"><label class="sr-only" [for]="'comment-'+postId()">Write a comment</label><textarea [id]="'comment-'+postId()" name="comment" [(ngModel)]="draft" maxlength="1000" rows="2" placeholder="Add something kind…" [disabled]="busy()"></textarea><button class="primary" [disabled]="busy()||!draft.trim()">{{busy()?'Please wait…':'Comment'}}</button></form></section>}
 `})
export class PostActivity {
 api=inject(MessengerApi);postId=input.required<string>();me=input.required<string>();owner=input.required<string>();profiles=input<Profile[]>([]);summary=input<Activity>();updated=signal<Activity|undefined>(undefined);
 expanded=signal(false);comments=signal<any[]>([]);busy=signal(false);loading=signal(false);more=signal(false);error=signal('');draft='';private pending='';
 current(){return this.updated()||this.summary();}name(id:string){return this.profiles().find(p=>p.id===id)?.name||'Member';}
 async refresh(){const {data,error}=await this.api.client.rpc('social_activity',{targets:[this.postId()]});if(error)throw error;this.updated.set(data?.[0]);}
 async react(kind:string){if(this.busy())return;this.busy.set(true);this.error.set('');try{
 const q=this.api.client.from('post_reactions');let result;
 if(this.current()?.mine===kind)result=await q.delete().eq('post_id',this.postId()).eq('user_id',this.me());
 else if(this.current()?.mine)result=await q.update({kind}).eq('post_id',this.postId()).eq('user_id',this.me());
 else result=await q.insert({post_id:this.postId(),kind});
 if(result.error && result.error.code!=='23505')throw result.error;await this.refresh();
 }catch{this.error.set('Could not update your reaction. Refresh and try again.');}finally{this.busy.set(false);}}
 toggle(){this.expanded.set(!this.expanded());if(this.expanded())void this.load();}
 async load(older=false){if(this.loading())return;this.loading.set(true);this.error.set('');try{
 let q=this.api.client.from('post_comments').select('*,profiles!post_comments_author_id_fkey(name)').eq('post_id',this.postId()).order('created_at',{ascending:false}).order('id',{ascending:false}).limit(20);
 const last=this.comments().at(-1);if(older&&last)q=q.or(`created_at.lt.${last.created_at},and(created_at.eq.${last.created_at},id.lt.${last.id})`);
 const {data,error}=await q;if(error)throw error;this.comments.set(older?[...this.comments(),...data]:data);this.more.set(data.length===20);
 }catch{this.error.set('Could not load comments. Close and reopen to retry.');}finally{this.loading.set(false);}}
 async send(){if(this.busy()||!this.draft.trim())return;this.busy.set(true);this.error.set('');this.pending ||= crypto.randomUUID();try{
 const {error}=await this.api.client.from('post_comments').insert({id:this.pending,post_id:this.postId(),body:this.draft.trim()});if(error&&error.code!=='23505')throw error;
 this.pending='';this.draft='';await this.load();await this.refresh();
 }catch(e){this.error.set((e as Error).message||'Could not comment. Your draft is kept here.');}finally{this.busy.set(false);}}
 async remove(id:string){if(this.busy())return;this.busy.set(true);this.error.set('');try{const {error}=await this.api.client.from('post_comments').delete().eq('id',id);if(error)throw error;await this.load();await this.refresh();}catch{this.error.set('Could not delete this comment.');}finally{this.busy.set(false);}}
}
