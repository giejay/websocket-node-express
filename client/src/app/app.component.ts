import {Component, ViewChild, ElementRef, OnInit, AfterViewInit} from '@angular/core';
import {WebSocketSubject} from 'rxjs/observable/dom/WebSocketSubject';
import {
  NgxGalleryOptions,
  NgxGalleryImage,
  NgxGalleryAnimation,
  NgxGalleryComponent,
  NgxGalleryOrder
} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';
import {IEvent, Lightbox, LIGHTBOX_EVENT, LightboxEvent} from "ngx-lightbox";

export class Message {
  constructor(
    public sender: string,
    public content: string,
    public isBroadcast = false,
    public type: string = 'text'
  ) {
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements AfterViewInit, OnInit {
  galleryOptions: NgxGalleryOptions[];
  galleryImages: NgxGalleryImage[] = [];

  public selectedImage: string;

  @ViewChild('viewer') private viewer: ElementRef;
  @ViewChild('gallery') private gallery: NgxGalleryComponent;
  @ViewChild('file') private file: HTMLInputElement;

  public serverMessages = new Array<Message>();

  public clientMessage = '';
  public isBroadcast = false;
  public sender = 'GJ2';
  public interval: number;

  private socket$: WebSocketSubject<Message>;
  private uploader: SocketIOFileClient;

  constructor(private imageSocket: Socket, private _lightbox: Lightbox, private _lightboxEvent: LightboxEvent) {
    this.socket$ = new WebSocketSubject('ws://localhost:8999');
    this.uploader = new SocketIOFileClient(imageSocket);
    this.socket$
      .subscribe(
        (message) => this.serverMessages.push(message) && this.scroll(),
        (err) => console.error(err),
        () => console.warn('Completed!')
      );

    imageSocket.on('image', (image) => {
      this.serverMessages.push(new Message('someone', image, false, 'image'));
    });

    this.uploader.on('start', function (fileInfo) {
      console.log('Start uploading', fileInfo);
    });
    this.uploader.on('stream', function (fileInfo) {
      console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
    });
    this.uploader.on('complete', function (fileInfo) {
      console.log('Upload Complete', fileInfo);
    });
    this.uploader.on('error', function (err) {
      console.log('Error!', err);
    });
    this.uploader.on('abort', function (fileInfo) {
      console.log('Aborted: ', fileInfo);
    });
  }


  getFiles($event): void {
    console.log(this.uploader.upload($event.target.files, {}));
  }

  ngOnInit(): void {

    this.galleryOptions = [{
      image: false,
      thumbnails: false,
      previewInfinityMove: true,
      thumbnailsColumns: 4,
      thumbnailsRows:5,
      thumbnailsOrder: NgxGalleryOrder.Row,
      // fullWidth: true,
      width: '100%',
      thumbnailsPercent: 25,
      height: '0px'
    }];

    for (let i = 0; i < 10; i++) {
      this.galleryImages.push(
        {
          small: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg',
          medium: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg',
          big: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg'
        },
        {
          small: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
          medium: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
          big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ'
        },
        {
          small: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
          medium: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
          big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp'
        });
    }
  }

  open(index: number): void {
    this.gallery.openPreview(index);
  }

  previewOpened(){
    this.interval = setInterval(() => {
      this.gallery.preview.showNext();
    }, 3000);
    console.log("preview opened")
  }

  previewClosed(){
    clearInterval(this.interval);
    console.log("preview closed")
  }

  previewChange(event: {index: number, image: NgxGalleryImage}){
    console.log(event.image);
  }

  ngAfterViewInit(): void {
    this.scroll();
    window.console.log(this.gallery)
  }

  public toggleIsBroadcast(): void {
    this.isBroadcast = !this.isBroadcast;
  }

  public send(): void {
    const message = new Message(this.sender, this.clientMessage, this.isBroadcast);

    this.serverMessages.push(message);
    this.socket$.next(message);
    this.clientMessage = '';
    this.scroll();
  }

  public isMine(message: Message): boolean {
    return message && message.sender === this.sender;
  }

  public getSenderInitials(sender: string): string {
    return sender && sender.substring(0, 2).toLocaleUpperCase();
  }

  public getSenderColor(sender: string): string {
    const alpha = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZ';
    const initials = this.getSenderInitials(sender);
    const value = Math.ceil((alpha.indexOf(initials[0]) + alpha.indexOf(initials[1])) * 255 * 255 * 255 / 70);
    return '#' + value.toString(16).padEnd(6, '0');
  }

  private scroll(): void {
    setTimeout(() => {
      this.scrollToBottom();
    }, 100);
  }

  private getDiff(): number {
    if (!this.viewer) {
      return -1;
    }

    const nativeElement = this.viewer.nativeElement;
    return nativeElement.scrollHeight - (nativeElement.scrollTop + nativeElement.clientHeight);
  }

  private scrollToBottom(t = 1, b = 0): void {
    if (b < 1) {
      b = this.getDiff();
    }
    if (b > 0 && t <= 120) {
      setTimeout(() => {
        const diff = this.easeInOutSin(t / 120) * this.getDiff();
        this.viewer.nativeElement.scrollTop += diff;
        this.scrollToBottom(++t, b);
      }, 1 / 60);
    }
  }

  private easeInOutSin(t): number {
    return (1 + Math.sin(Math.PI * t - Math.PI / 2)) / 2;
  }
}
