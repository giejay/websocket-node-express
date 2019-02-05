import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {
  MatButtonModule,
  MatCheckboxModule,
  MatInputModule,
  MatButtonToggleModule,
  MatIconModule
} from '@angular/material';
import {SocketIoModule, SocketIoConfig} from 'ngx-socket-io';
import {AppComponent} from './app.component';
import {ChatService} from "./chat.service";

const config: SocketIoConfig = {url: 'http://localhost:3000', options: {}};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    SocketIoModule.forRoot(config)
  ],
  providers: [ChatService],
  bootstrap: [AppComponent]
})
export class AppModule {
}
