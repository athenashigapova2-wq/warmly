import { Component, signal, ViewChild, ElementRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { createChatTransport, hosted } from './transport';

interface Member { id: string; name: string }
interface Message { id: string; sender: Member; text: string; createdAt: string }
@Component({ selector: 'warmly-app', standalone: true, imports: [FormsModule, DatePipe], templateUrl: './app.html' })
class App {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  hosted = hosted;
  name = ''; draft = '';
  joined = signal(false); connected = signal(false); pending = signal(false);
  error = signal(''); messages = signal<Message[]>([]); members = signal<Member[]>([]);
  self = signal<Member | null>(null);
  ownIds = new Set<string>();
  socket = createChatTransport();
  constructor() {
    this.socket.on('connect', () => {
      this.socket.timeout(5000).emit('join', { name: this.name }, (err, result) => {
        if (err || result?.error || !result?.self) {
          this.error.set(result?.error || 'Could not join the chat. Please try again.');
          this.pending.set(false); this.socket.disconnect(); return;
        }
        this.self.set(result.self); this.ownIds.add(result.self.id);
        this.messages.set(result.messages); this.joined.set(true); this.connected.set(true);
        this.pending.set(false); this.error.set(''); this.scroll();
      });
    });
    this.socket.on('disconnect', () => { this.connected.set(false); this.pending.set(false); });
    this.socket.on('recovered', () => { this.connected.set(true); this.error.set(''); });
    this.socket.on('connect_error', () => { this.error.set('Cannot reach the server. Reconnecting…'); this.connected.set(false); this.pending.set(false); });
    this.socket.on('presence', (members: Member[]) => this.members.set(members));
    this.socket.on('message:new', (message: Message) => this.add(message));
  }
  join() { if (!this.name.trim() || this.pending()) return; this.name = this.name.trim(); this.error.set(''); this.pending.set(true); this.socket.connect(); }
  leave() { this.socket.disconnect(); this.joined.set(false); this.messages.set([]); this.members.set([]); this.self.set(null); this.ownIds.clear(); this.draft = ''; this.error.set(''); }
  add(message: Message) {
    if (this.messages().some(item => item.id === message.id)) return;
    this.messages.update(items => [...items, message].slice(-100)); this.scroll();
  }
  scroll() { setTimeout(() => { const el = this.timeline?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }); }
  send() {
    if (!this.draft.trim() || !this.connected() || this.pending()) return;
    const text = this.draft;
    this.pending.set(true); this.error.set('');
    this.socket.timeout(5000).emit('message:send', { text, clientMessageId: crypto.randomUUID() }, (err, result) => {
      this.pending.set(false);
      if (err || result?.error || !result?.message) {
        this.error.set(result?.error || 'No confirmation received. Check the chat before sending again.'); return;
      }
      this.add(result.message); if (this.draft === text) this.draft = '';
    });
  }
  keydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); this.send(); } }
}
bootstrapApplication(App).catch(console.error);
