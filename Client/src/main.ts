import { Component, signal, computed, ViewChild, ElementRef } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { io } from 'socket.io-client';

interface Member { id: string; name: string }
interface Message { id: string; sender: Member; text: string; createdAt: string }
@Component({
  selector: 'warmly-app', standalone: true, imports: [FormsModule, DatePipe],
  templateUrl: './app.html'
})
class App {
  @ViewChild('timeline') timeline?: ElementRef<HTMLElement>;
  name = ''; draft = '';
  joined = signal(false); connected = signal(false); pending = signal(false);
  error = signal(''); messages = signal<Message[]>([]); members = signal<Member[]>([]);
  self = signal<Member | null>(null);
  ownIds = new Set<string>();
  others = computed(() => this.members().filter(m => m.id !== this.self()?.id));
  socket = io({ autoConnect: false });
  constructor() {
    this.socket.on('connect', () => {
      this.socket.timeout(5000).emit('join', { name: this.name }, (err: Error | null, result: { error?: string; self: Member; messages: Message[] }) => {
        if (err || result.error) { this.error.set(result?.error || 'Не удалось войти. Попробуйте ещё раз.'); this.pending.set(false); this.socket.disconnect(); return; }
        this.self.set(result.self); this.ownIds.add(result.self.id);
        this.messages.set(result.messages); this.joined.set(true); this.connected.set(true);
        this.pending.set(false); this.error.set(''); this.scroll();
      });
    });
    this.socket.on('disconnect', () => { this.connected.set(false); this.pending.set(false); });
    this.socket.on('connect_error', () => { this.error.set('Нет связи с сервером. Пробуем подключиться снова…'); this.connected.set(false); this.pending.set(false); });
    this.socket.on('presence', (members: Member[]) => this.members.set(members));
    this.socket.on('message:new', (message: Message) => { this.add(message); });
  }
  join() { if (!this.name.trim() || this.pending()) return; this.name = this.name.trim(); this.error.set(''); this.pending.set(true); this.socket.connect(); }
  leave() { this.socket.disconnect(); this.joined.set(false); this.messages.set([]); this.members.set([]); this.self.set(null); this.ownIds.clear(); this.draft = ''; this.error.set(''); }
  add(message: Message) { this.messages.update(items => items.some(m => m.id === message.id) ? items : [...items, message].slice(-100)); this.scroll(); }
  scroll() { setTimeout(() => { const el = this.timeline?.nativeElement; if (el) el.scrollTop = el.scrollHeight; }); }
  send() {
    if (!this.draft.trim() || !this.connected() || this.pending()) return;
    const text = this.draft;
    this.pending.set(true); this.error.set('');
    this.socket.timeout(5000).emit('message:send', { text, clientMessageId: crypto.randomUUID() }, (err: Error | null, result: { error?: string; message: Message }) => {
      this.pending.set(false);
      if (err || result.error) { this.error.set(result?.error || 'Подтверждение не пришло. Проверьте чат перед повторной отправкой.'); return; }
      this.add(result.message); if (this.draft === text) this.draft = '';
    });
  }
  keydown(event: KeyboardEvent) { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); this.send(); } }
}
bootstrapApplication(App).catch(console.error);
