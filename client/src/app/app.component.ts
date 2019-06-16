import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {INgxGalleryImage, NgxGalleryComponent, NgxGalleryImage, NgxGalleryOptions, NgxGalleryOrder} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';
import {ActivatedRoute} from '@angular/router';

declare var EXIF: any;
declare var loadImage: any;

class UploadImage {
  constructor(public file: FileList,
              public content: Buffer,
              public description: string,
              public isUploading: boolean = false,
              public uploadingPercentage: number = 0,
              public orientation: any = {},
              public fileSize: number = 0) {
  }
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  galleryOptions: NgxGalleryOptions[];
  galleryImages: { [imageName: string]: INgxGalleryImage } = {};

  @ViewChild('gallery') private gallery: NgxGalleryComponent;
  @ViewChild('file') private file: ElementRef;
  @ViewChild('imageElement') private image: HTMLImageElement;

  public slideShowInterval: any;
  private uploader: SocketIOFileClient;
  private imagesShown: Array<string> = [];
  public token: string;
  public uploadingImage: UploadImage;

  constructor(private imageSocket: Socket, private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      this.token = params['token'];
    });
    this.uploader = new SocketIOFileClient(imageSocket);

    this.registerIncomingImageCallback(imageSocket);
    this.registerDeleteImageCallback();
    this.registerUploaderCallbacks();
  }

  upload() {
    console.log('Uploading file');
    this.uploader.upload(this.uploadingImage.file, {data: {description: this.uploadingImage.description}});
  }

  getClass() {
    return this.uploadingImage.orientation.value;
  }

  getFiles($event): void {
    this.uploadingImage = new UploadImage($event.target.files, Buffer.alloc(0), '');
    loadImage(
      $event.target.files[0],
      (img) => {
        this.uploadingImage.content = img.toDataURL();
      },
      {orientation: true} // Options
    );
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
      previewDescription: true,
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
        description: 'Poarneemn'
      };
    this.galleryImages['01_01_slide_nature.jpg'] =
      {
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/01_01_slide_nature.jpg?itok=NOMtH0PJ',
        label: '01_01_slide_nature.jpg',
        description: 'Prachtig prachtig'
      };
    this.galleryImages['02_01_slide_nature.jpg'] =
      {
        big: 'https://croatia.hr/sites/default/files/styles/image_full_width/public/2017-08/02_01_slide_nature.jpg?itok=ItAHmLlp',
        label: '02_01_slide_nature.jpg',
        description: 'Mooie natuur afbeelding'
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

  private registerIncomingImageCallback(imageSocket: Socket) {
    imageSocket.on('image', (image) => {
      console.log('receiving image!', image);
      if (this.galleryImages[image.name]) {
        console.log('Already processed the image: ' + image.name);
        return;
      }
      this.galleryImages[image.name] = new NgxGalleryImage({
        big: imageSocket.ioSocket.io.uri + '/images/' + image.name,
        label: image.name,
        description: image.description,
      });
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

      if (this.gallery.preview.previewImage) {
        // rewrite images and index so we wont have out of bounds errors when slideshowing
        this.gallery.preview.images = Object.keys(this.galleryImages).map(image => this.galleryImages[image].big) as string[];
        const selectedImage = this.getImages().map(image => image.big).indexOf(this.gallery.preview.previewImage.nativeElement.src);
        this.gallery.preview.index = selectedImage !== -1 ? selectedImage : 0;
      }
    });
  }

  private registerUploaderCallbacks() {
    // sending part
    this.uploader.on('start', (fileInfo) => {
      console.log('Start uploading', fileInfo);
      this.uploadingImage.isUploading = true;
      this.uploadingImage.fileSize = fileInfo.size;
    });
    this.uploader.on('stream', (fileInfo) => {
      console.log('Streaming... sent ' + fileInfo.sent + ' bytes.');
      this.uploadingImage.uploadingPercentage = Math.round((fileInfo.sent / this.uploadingImage.fileSize) * 100);
    });
    this.uploader.on('complete', (fileInfo) => {
      console.log('Upload Complete', fileInfo);
      delete this.uploadingImage;
    });
    this.uploader.on('error', (err) => {
      console.log('Error!', err);
      delete this.uploadingImage;
    });
    this.uploader.on('abort', (fileInfo) => {
      console.log('Aborted: ', fileInfo);
      delete this.uploadingImage;
    });
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
