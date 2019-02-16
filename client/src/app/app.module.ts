import {BrowserModule} from '@angular/platform-browser';
import {FormsModule} from '@angular/forms';
import {NgModule} from '@angular/core';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';
import {
  MatButtonModule,
  MatCheckboxModule,
  MatInputModule,
  MatButtonToggleModule,
  MatIconModule,
  MatCardModule
} from '@angular/material';
import {SocketIoModule, SocketIoConfig} from 'ngx-socket-io';
import {AppComponent} from './app.component';
import { NgxGalleryModule } from 'ngx-gallery';
import { LightboxModule } from 'ngx-lightbox';

const config: SocketIoConfig = {url: 'http://localhost:3000', options: {}};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
    LightboxModule,
    NgxGalleryModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatCheckboxModule,
    SocketIoModule.forRoot(config)
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
