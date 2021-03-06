import {Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {INgxGalleryImage, NgxGalleryComponent, NgxGalleryImage, NgxGalleryOptions, NgxGalleryOrder} from 'ngx-gallery';
import {Socket} from 'ngx-socket-io';
import SocketIOFileClient from 'socket.io-file-client';
import {ActivatedRoute} from '@angular/router';

declare var loadImage: any;

class UploadImage {
  constructor(public file: FileList,
              public content: string,
              public description: string,
              public isUploading: boolean = false,
              public uploadingPercentage: number = 0,
              public orientation: any = {},
              public fileSize: number = 0,
              public width: number = 0) {
  }
}

class User {
  constructor(public token?: string,
              public state: number = -1) {

  }

  loggedIn(): boolean {
    return this.state > 0;
  }
}

class Image {
  constructor(public name: string, public description: string) {
  }
}

class EnrichedGalleryImage extends NgxGalleryImage {
  public previewShown: boolean;
}

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  galleryOptions: NgxGalleryOptions[];
  galleryImages: { [imageName: string]: EnrichedGalleryImage } = {};

  @ViewChild('gallery') private gallery: NgxGalleryComponent;
  @ViewChild('file') private file: ElementRef;

  public slideShowInterval: any;
  private slideShowIntervalMillis = 8000;
  private imageShownTimeout;
  private uploader: SocketIOFileClient;
  public user: User;
  public uploadingImage: UploadImage;
  public defaultImage = 'assets/img/default.jpg';
  public offset = 150;
  public positionBeforeMovingToNewPhoto = -1;
  public reloading: boolean;
  private onlyShowNewPhotos: boolean;

  constructor(private imageSocket: Socket, private route: ActivatedRoute) {
    this.route.queryParams.subscribe(params => {
      const interval: string = params['interval'];
      if (interval) {
        this.slideShowIntervalMillis = parseInt(interval, 0) * 1000;
      }
      this.onlyShowNewPhotos = params['onlyNew'] || false;
    });
    this.user = new User();
    this.uploader = new SocketIOFileClient(imageSocket);

    this.loginUserFromStorage();
    this.registerLoginEvent();
    this.registerIncomingImageCallback();
    this.registerDeleteImageCallback();
    this.registerUploaderCallbacks();
  }

  ngOnInit(): void {
    const galleryOption = {
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
  }

  login() {
    this.imageSocket.emit('login', this.user.token);
  }

  upload() {
    this.uploader.upload(this.uploadingImage.file, {
      data: {
        description: this.uploadingImage.description,
        token: this.user.token
      }
    });
  }

  getFiles($event): void {
    if ($event.target.files.length) {
      this.uploadingImage = new UploadImage($event.target.files, '', '');
      this.parseImage($event.target.files[0]).then((image: HTMLCanvasElement) => {
        this.uploadingImage.width = Math.min(window.innerWidth - 30, image.width);
        this.uploadingImage.content = image.toDataURL();
      });
      // clear input
      delete this.file.nativeElement.value;
    }
  }

  getImages() {
    return Object.keys(this.galleryImages).map(key => this.galleryImages[key]);
  }

  open(index: number): void {
    this.gallery.openPreview(index);
  }

  delete(imageName: string): void {
    this.imageSocket.emit('delete', {image: imageName, token: this.user.token});
  }

  stopSlideShow() {
    clearInterval(this.slideShowInterval);
    delete this.slideShowInterval;
    const ngxGalleryOption = this.galleryOptions[0];
    if (ngxGalleryOption && ngxGalleryOption.actions) {
      ngxGalleryOption.actions[0].icon = 'fa fa-play-circle';
    }
  }

  previewChanged($event) {
    clearTimeout(this.imageShownTimeout);
    if ($event.index === 0 && this.positionBeforeMovingToNewPhoto !== -1) {
      // jump back to last position when all the new photos are shown and we are at the beginning again
      const position = this.positionBeforeMovingToNewPhoto;
      // reset it again so it wont move to this position indefinitely
      this.positionBeforeMovingToNewPhoto = -1;
      // position is stored in a constant and reset first so previewChanged method wont "stackoverflow"
      this.gallery.preview.showAtIndex(position);
    }
    const currentPreviewImage = this.getImages()[$event.index];
    if (!currentPreviewImage.previewShown) {
      this.imageShownTimeout = setTimeout(() => {
        console.log('setting preview to true for image', currentPreviewImage.big);
        // only set it after the photo has been shown for at least x seconds to prevent new photos overlapping each other very fast
        currentPreviewImage.previewShown = true;
      }, this.slideShowIntervalMillis - 1000);
    }
  }

  exitUpload() {
    delete this.uploadingImage;
  }

  private registerLoginEvent() {
    this.imageSocket.on('loginCallback', (authState) => {
      this.user.state = authState;
      if (this.user.state > 0) {
        window.localStorage.setItem('user-token', this.user.token as string);
      }
    });
  }

  private registerIncomingImageCallback() {
    this.imageSocket.on('image', (image) => {
      console.log('receiving image!', image);
      const allPhotosShown = this.allPhotosShown();
      if (this.addPhoto(image)) {
        const imagePreLoadPromise = this.preLoad('images/' + image.name);
        if (this.slideShowInterval && this.gallery.preview && allPhotosShown) {
          console.log('All photos are shown, lets jump to the newly uploaded');
          // first make sure the image is loaded before showing it or else it will be a spinner for half of the time its showing
          imagePreLoadPromise.then(() => {
            console.log('Done preloading image', image.name);
            // all photos have been shown already, jump to the last!
            // save current position to restore if all new photos also have been shown
            this.positionBeforeMovingToNewPhoto = this.gallery.preview.index;
            // Reset the slideshow so it wont show it for less than x seconds
            this.slideShow();
            this.gallery.preview.showAtIndex(Object.keys(this.galleryImages).length - 1);
          });
        }
      }
    });

    this.imageSocket.on('images', (images: Image[]) => {
      console.log('receiving initial images', images);
      images.forEach(img => this.addPhoto(img));
    });
  }

  private addPhoto(image: Image) {
    if (this.onlyShowNewPhotos && image.name.length <= 8) {
      // default images are max 8 chars
      return false;
    }
    if (this.galleryImages[image.name]) {
      console.log('Already processed the image: ' + image.name);
      return false;
    }
    this.galleryImages[image.name] = new EnrichedGalleryImage({
      big: 'images/' + image.name,
      label: image.name,
      description: image.description
    });
    return true;
  }

  private allPhotosShown() {
    const imagesNotShown = Object.keys(this.galleryImages).map(key => this.galleryImages[key]).filter(img => !img.previewShown).length;
    console.log('Image not shown yet', imagesNotShown);
    return imagesNotShown === 0;
  }

  private registerDeleteImageCallback() {
    this.imageSocket.on('imageDeleted', (image) => {
      if (this.slideShowInterval) {
        // timing issue in deleting photos and playing so reboot the slideshow
        this.slideShow();
      }
      delete this.galleryImages[image.name];

      if (this.gallery.preview.previewImage) {
        // rewrite images and index so we wont have out of bounds errors when slideshowing
        this.gallery.preview.images = Object.keys(this.galleryImages).map(img => this.galleryImages[img].big) as string[];
        if (this.gallery.preview.index !== 0) {
          this.gallery.preview.index = this.gallery.preview.index - 1;
        }
      }
    });
  }

  private registerUploaderCallbacks() {
    // sending part
    this.uploader.on('start', (fileInfo) => {
      console.log('Start uploading', fileInfo);
      this.uploadingImage.isUploading = true;
      this.uploadingImage.fileSize = fileInfo.size;
      // weird bug in lazy loading library not fetching images without a reload of html
      this.reloading = true;
      setTimeout(() => {
        this.reloading = false;
      }, 5);
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
    }, this.slideShowIntervalMillis);
  }

  private parseImage(file) {
    return new Promise((resolve) => {
      loadImage(
        file,
        (img: HTMLCanvasElement) => {
          resolve(img);
        },
        {orientation: true} // Options
      );
    });
  }

  private loginUserFromStorage() {
    const userToken = window.localStorage.getItem('user-token');
    if (userToken) {
      this.user.token = userToken;
      this.login();
    }
  }

  private preLoad(url: string): Promise<any> {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        resolve();
      };
      img.src = url;
    });
  }

}
