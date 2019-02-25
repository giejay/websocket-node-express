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
const jo = require('jpeg-autorotate');

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

  @ViewChild('viewer') private viewer: ElementRef;
  @ViewChild('gallery') private gallery: NgxGalleryComponent;
  @ViewChild('file') private file: ElementRef;

  public serverMessages = new Array<Message>();

  public clientMessage = '';
  public isBroadcast = false;
  public sender = 'GJ2';
  public interval: any;

  private socket$: WebSocketSubject<Message>;
  private uploader: SocketIOFileClient;
  private imagesShown: Array<number> = [];

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
      console.log('receiving image!');
      this.galleryImages.push({
        small: 'data:image/png;base64,' + image,
        medium: 'data:image/png;base64,' + image,
        big: 'data:image/png;base64,' + image
      });
      this.serverMessages.push(new Message('someone', image, false, 'image'));
      if(this.imagesShown.length === this.galleryImages.length - 1){
        // all photos have been shown allready, jump to the last!
        console.log('jumping to last!');
        clearInterval(this.interval);
        this.gallery.preview.showAtIndex(this.galleryImages.length - 1);
        this.slideShow();
      }
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
    console.log('Got the file!')
    const fileReader = new FileReader();
    const uploader = this.uploader;
    fileReader.onloadend = function() {
      console.log('reading the byte array');
      jo.rotate( Buffer.from(fileReader.result), {quality: 75}, (error: any, buffer: any, orientation: any, dimensions: any) => {
        if (error) {
          // buffer = bitmap;
          // todo make it smaller over here!!
          buffer = fileReader.result;
          console.log('An error occurred when rotating the file: ' + error.message)
        } else {
          console.log('Orientation was: ' + orientation)
          console.log('Height after rotation: ' + dimensions.height)
          console.log('Width after rotation: ' + dimensions.width)
          // ...
          // Do whatever you need with the resulting buffer
          // ...
        }
        console.log(uploader.upload({files: [new File([buffer], 'fileName', {'type': 'image/jpeg'})]}, {}));
      });
    };
    fileReader.readAsArrayBuffer($event.target.files[0]);
    delete this.file.nativeElement.value;
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

    for (let i = 0; i < 1; i++) {
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
    this.slideShow();
    console.log("preview opened")
  }

  private slideShow() {
    this.interval = setInterval(() => {
      if (this.imagesShown.indexOf(this.gallery.preview.index) < 0) {
        this.imagesShown.push(this.gallery.preview.index);
      }
      this.gallery.preview.showNext();
    }, 3000);
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

  private orientation = function(file, callback) {
    var fileReader = new FileReader();
    fileReader.onloadend = function() {
      var scanner = new DataView(fileReader.result);
      var idx = 0;
      var value = 1; // Non-rotated is the default
      if(fileReader.result.length < 2 || scanner.getUint16(idx) != 0xFFD8) {
        // Not a JPEG
        if(callback) {
          callback(value);
        }
        return;
      }
      idx += 2;
      var maxBytes = scanner.byteLength;
      while(idx < maxBytes - 2) {
        var uint16 = scanner.getUint16(idx);
        idx += 2;
        switch(uint16) {
          case 0xFFE1: // Start of EXIF
            var exifLength = scanner.getUint16(idx);
            maxBytes = exifLength - idx;
            idx += 2;
            break;
          case 0x0112: // Orientation tag
            // Read the value, its 6 bytes further out
            // See page 102 at the following URL
            // http://www.kodak.com/global/plugins/acrobat/en/service/digCam/exifStandard2.pdf
            value = scanner.getUint16(idx + 6, false);
            maxBytes = 0; // Stop scanning
            break;
        }
      }
      if(callback) {
        callback(value);
      }
    }
    fileReader.readAsArrayBuffer(file);
  };
}
