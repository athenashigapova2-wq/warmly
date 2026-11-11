import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app';
import { MessengerApi } from './transport';
bootstrapApplication(App, {providers:[MessengerApi]}).catch(console.error);
