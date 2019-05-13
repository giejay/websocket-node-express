import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {NgxGalleryComponent, NgxGalleryImage, NgxGalleryOptions, NgxGalleryOrder} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';
import {ActivatedRoute} from "@angular/router";

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
  private imagesShown: Array<string> = [];
  public isUploading: boolean;
  public uploadingPercentage: number = 0;
  public fileSize: number;
  public token: string;

  constructor(private imageSocket: Socket, private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
    });
    this.uploader = new SocketIOFileClient(imageSocket);

    this.registerIncomingImageCallback(imageSocket);
    this.registerDeleteImageCallback();
    this.registerUploaderCallbacks();
  }

  private registerIncomingImageCallback(imageSocket: Socket) {
    imageSocket.on('image', (image) => {
      console.log('receiving image!', image);
      if (this.galleryImages[image.name]) {
        console.log('Already processed the image: ' + image.name);
        return;
      }
      this.galleryImages[image.name] = {
        big: 'data:image/png;base64,' + image.content,
        label: image.name,
        description: image.name,
      };
      let imageCount = Object.keys(this.galleryImages).length;
      if (this.imagesShown.length === imageCount - 1) {
        // all photos have been shown already, jump to the last!
        console.log('jumping to last!');
        // Reset the slideshow so it wont show it for less than 3 seconds
        this.slideShow();
        this.gallery.preview.showAtIndex(imageCount - 1);
      }
    });
  }

  private registerDeleteImageCallback() {
    this.imageSocket.on('imageDeleted', (image) => {
      if (this.slideShowInterval) {
        // timing issue in deleting photos and playing
        this.slideShow();
      }
      delete this.galleryImages[image.name];
      this.imagesShown.splice(this.imagesShown.indexOf(image.name), 1);

      // rewrite images and index so we wont have out of bounds errors when slideshowing
      this.gallery.preview.images = Object.keys(this.galleryImages).map(image => this.galleryImages[image].big) as string[];
      const selectedImage = this.getImages().map(image => image.big).indexOf(this.gallery.preview.previewImage.nativeElement.src);
      this.gallery.preview.index = selectedImage !== -1 ? selectedImage : 0;
    });
  }

  private registerUploaderCallbacks() {
    // sending part
    this.uploader.on('start', (fileInfo) => {
      console.log('Start uploading', fileInfo);
      this.isUploading = true;
      this.uploadingPercentage = 0;
      this.fileSize = fileInfo.size;
    });
    this.uploader.on('stream', (fileInfo) => {
      console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
      this.uploadingPercentage = Math.round((fileInfo.sent / this.fileSize) * 100);
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
      previewDescription: false,
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
            if (this.slideShowInterval) {
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
        big: 'https://d2lm6fxwu08ot6.cloudfront.net/img-thumbs/960w/8V46UZCS0V.jpg',
        label: '8V46UZCS0V.jpg',
        description: '8V46UZCS0V.jpg'
      };
    this.galleryImages['01_01_slide_nature.jpg'] =
      {
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
        label: '01_01_slide_nature.jpg',
        description: '01_01_slide_nature.jpg'
      };
    this.galleryImages['02_01_slide_nature.jpg'] =
      {
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
        label: '02_01_slide_nature.jpg',
        description: '02_01_slide_nature.jpg'
      };
  }

  getImages() {
    return Object.keys(this.galleryImages).map(key => this.galleryImages[key]);
  }

  open(index: number): void {
    this.gallery.openPreview(index);
  }

  delete(imageName: string): void {
    this.imageSocket.emit('delete', {image: imageName, token: this.token});
  }

  stopSlideShow() {
    clearInterval(this.slideShowInterval);
    delete this.slideShowInterval;
    this.imagesShown = [];
    let ngxGalleryOption = this.galleryOptions[0];
    if (ngxGalleryOption && ngxGalleryOption.actions) {
      ngxGalleryOption.actions[0].icon = 'fa fa-play-circle';
    }
  }

  previewChanged($event) {
    const image = this.getImages()[$event.index];
    if (this.imagesShown.indexOf(image.label as string) < 0) {
      this.imagesShown.push(image.label as string);
    }
  }

  private slideShow() {
    if (this.slideShowInterval) {
      clearInterval(this.slideShowInterval);
    }
    this.slideShowInterval = setInterval(() => {
      this.gallery.preview.showNext();
    }, 3000);
  }

}
