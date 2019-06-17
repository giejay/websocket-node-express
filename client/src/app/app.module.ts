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
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {RouterModule} from '@angular/router';
import { LazyLoadImageModule } from 'ng-lazyload-image';
// todo move this to constants somehow
// const config: SocketIoConfig = {url: 'http://localhost:3000', options: {}};
const config: SocketIoConfig = {url: 'http://transip.giejay.nl:3000', options: {}};

@NgModule({
  declarations: [
    AppComponent
  ],
  imports: [
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
    MatProgressSpinnerModule,
    RouterModule.forRoot([]),
    SocketIoModule.forRoot(config),
    LazyLoadImageModule.forRoot({})
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
