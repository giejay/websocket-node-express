import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {NgxGalleryComponent, NgxGalleryImage, NgxGalleryOptions, NgxGalleryOrder} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  galleryOptions: NgxGalleryOptions[];
  galleryImages: { [imageName: string]: NgxGalleryImage } = {};

  @ViewChild('gallery') private gallery: NgxGalleryComponent;
  @ViewChild('file') private file: ElementRef;

  public slideShowInterval: any;
  private uploader: SocketIOFileClient;
  private imagesShown: Array<number> = [];
  public isUploading: boolean;
  public uploadingPercentage: number = 60;
  public fileSize: number;

  constructor(private imageSocket: Socket) {
    this.uploader = new SocketIOFileClient(imageSocket);

    // receiving part
    imageSocket.on('image', (image) => {
      console.log('receiving image!', image);
      if (this.galleryImages[image.name]) {
        console.log('Allready processed the image: ' + image.name);
        return;
      }
      this.galleryImages[image.name] = {
        // small: 'data:image/png;base64,' + image.content,
        // medium: 'data:image/png;base64,' + image.content,
        big: 'data:image/png;base64,' + image.content
      };
      let imageCount = Object.keys(this.galleryImages).length;
      if (this.imagesShown.length === imageCount - 1) {
        // all photos have been shown allready, jump to the last!
        console.log('jumping to last!');
        // reset it so it won't play the last image for example for 1 second.
        clearInterval(this.slideShowInterval);
        this.gallery.preview.showAtIndex(imageCount - 1);
        this.slideShow();
      }
    });

    // sending part
    this.uploader.on('start', (fileInfo) => {
      console.log('Start uploading', fileInfo);
      this.isUploading = true;
      this.uploadingPercentage = 0;
      this.fileSize = fileInfo.size;
    });
    this.uploader.on('stream', (fileInfo) => {
      console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
      this.uploadingPercentage = (fileInfo.sent / this.fileSize) * 100;
      console.log(this.uploadingPercentage);
    });
    this.uploader.on('complete', (fileInfo) => {
      console.log('Upload Complete', fileInfo);
      this.isUploading = false;
    });
    this.uploader.on('error', (err) => {
      console.log('Error!', err);
      this.isUploading = false;
    });
    this.uploader.on('abort', (fileInfo) => {
      console.log('Aborted: ', fileInfo);
      this.isUploading = false;
    });
  }

  getFiles($event): void {
    console.log('Uploading file');
    this.uploader.upload($event.target.files, {});
    // clear input
    delete this.file.nativeElement.value;
  }

  ngOnInit(): void {
    let galleryOption = {
      image: false,
      thumbnails: false,
      previewInfinityMove: true,
      thumbnailsColumns: 4,
      thumbnailsRows: 5,
      thumbnailsOrder: NgxGalleryOrder.Row,
      // fullWidth: true,
      width: '100%',
      thumbnailsPercent: 25,
      height: '0px',
      actions: [
        {
          icon: 'fa fa-play-circle',
          titleText: 'Play',
          onClick: () => {
            if(this.slideShowInterval){
              galleryOption.actions[0].icon = 'fa fa-play-circle';
              this.stopSlideShow();
            } else {
              galleryOption.actions[0].icon = 'fa fa-pause-circle';
              this.slideShow();
            }
          }
        }
      ]
    };
    this.galleryOptions = [galleryOption];

    this.galleryImages['8V46UZCS0V.jpg'] =
      {
        small: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg',
        medium: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg',
        big: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg'
      };
    this.galleryImages['01_01_slide_nature.jpg'] =
      {
        small: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
        medium: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ'
      };
    this.galleryImages['02_01_slide_nature.jpg'] =
      {
        small: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
        medium: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp'
      };
  }

  getImages(){
    return Object.keys(this.galleryImages).map(key => this.galleryImages[key]);
  }

  open(index: number): void {
    this.gallery.openPreview(index);
  }

  stopSlideShow() {
    clearInterval(this.slideShowInterval);
    delete this.slideShowInterval;
  }

  private slideShow() {
    if (this.slideShowInterval) {
      clearInterval(this.slideShowInterval);
    }
    this.slideShowInterval = setInterval(() => {
      if (this.imagesShown.indexOf(this.gallery.preview.index) < 0) {
        this.imagesShown.push(this.gallery.preview.index);
      }
      this.gallery.preview.showNext();
    }, 3000);
  }

}
