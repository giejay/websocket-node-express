import {Component, ViewChild, ElementRef, OnInit, AfterViewInit} from '@angular/core';
import {WebSocketSubject} from 'rxjs/observable/dom/WebSocketSubject';
import {NgxGalleryOptions, NgxGalleryImage, NgxGalleryAnimation} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';

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
  galleryImages: NgxGalleryImage[];

  @ViewChild('viewer') private viewer: ElementRef;
  @ViewChild('gallery') private gallery: ElementRef;

  public serverMessages = new Array<Message>();

  public clientMessage = '';
  public isBroadcast = false;
  public sender = 'GJ2';

  private socket$: WebSocketSubject<Message>;
  private uploader: SocketIOFileClient;

  constructor(private imageSocket: Socket) {
    this.socket$ = new WebSocketSubject('ws://localhost:8999');
    this.uploader = new SocketIOFileClient(imageSocket);
    this.socket$
      .subscribe(
        (message) => this.serverMessages.push(message) && this.scroll(),
        (err) => console.error(err),
        () => console.warn('Completed!')
      );

    imageSocket.on('image', (image)=> {
      this.serverMessages.push(new Message('someone', image, false, 'image'));
    });

    this.uploader.on('start', function(fileInfo) {
      console.log('Start uploading', fileInfo);
    });
    this.uploader.on('stream', function(fileInfo) {
      console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
    });
    this.uploader.on('complete', function(fileInfo) {
      console.log('Upload Complete', fileInfo);
    });
    this.uploader.on('error', function(err) {
      console.log('Error!', err);
    });
    this.uploader.on('abort', function(fileInfo) {
      console.log('Aborted: ', fileInfo);
    });
  }


  getFiles($event): void {
    console.log(this.uploader.upload($event.target.files, {}));
  }

  ngOnInit(): void {
    this.galleryOptions = [
      {
        width: '100%',
        height: '900px',
        thumbnailsColumns: 4,
        imageAnimation: NgxGalleryAnimation.Slide,
        imageAutoPlay: true,
        imageAutoPlayInterval: 5000
      },
      // // max-width 800
      // {
      //   breakpoint: 800,
      //   width: '100%',
      //   height: '600px',
      //   imagePercent: 80,
      //   thumbnailsPercent: 20,
      //   thumbnailsMargin: 20,
      //   thumbnailMargin: 20
      // }
    ];

    this.galleryImages = [
      {
        small: 'assets/photo1.jpg',
        medium: 'assets/photo1.jpg',
        big: 'assets/photo1.jpg'
      },
      {
        small: 'assets/photo2.jpg',
        medium: 'assets/photo2.jpg',
        big: 'assets/photo2.jpg'
      },
      {
        small: 'assets/photo3.jpg',
        medium: 'assets/photo3.jpg',
        big: 'assets/photo3.jpg'
      }
    ];
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
