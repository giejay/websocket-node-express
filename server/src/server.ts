import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
// @ts-ignore
import piexif from 'piexifjs'
import ErrnoException = NodeJS.ErrnoException;

const fs = require('fs-extra');
const app = express();

// Websocket server
const imageServer = http.createServer(app);
const ws = require('socket.io')(imageServer);
const SocketIOFile = require('socket.io-file');
const jo = require('jpeg-autorotate');
const options = {quality: 65};

const imageExtensions = ['.png', '.jpg', '.jpeg'];
let counter = 0;
const token = process.env.token;

ws.on('connection', (socket: WebSocket) => {
    console.log('Socket connected.');
    registerOnDeleteHandle(socket);
    registerFileUploadHandle(socket);
    sendCurrentImages(socket);
});

let registerFileUploadHandle = function (socket: WebSocket) {
    const uploader = new SocketIOFile(socket, {
        // uploadDir: {			// multiple directories
        // 	music: 'data/music',
        // 	document: 'data/document'
        // },
        uploadDir: 'data/incoming',							// simple directory
        accepts: ['image/jpeg', 'image/png'],		// chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
        maxFileSize: 10000000, 						// 4 MB. default is undefined(no limit)
        chunkSize: 100240,
        transmissionDelay: 0,						// delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: true,					// overwrite file if exists, default is true.
        rename: () => {
            return new Date().getTime() + '_' + counter++ + '.jpeg';
        }
    });
    uploader.on('start', (fileInfo: any) => {
        console.log('Start uploading');
        console.log(fileInfo);
    });
    uploader.on('stream', (fileInfo: any) => {
        console.log(`${fileInfo.wrote} / ${fileInfo.size} byte(s)`);
    });

    uploader.on('complete', (fileInfo: any) => {
        console.log('Upload Complete.', fileInfo);

        rotate(fileInfo.uploadDir).then(buffer => {

            fs.writeFile('data/processed/' + fileInfo.name, buffer).then(() => {
                fs.writeFile('data/processed/' + fileInfo.name + '_desc.txt', fileInfo.data.description).then(() => {
                    // Send the image to all connected clients
                    ws.clients().emit('image', {name: fileInfo.name, description: fileInfo.data.description})
                });
            }).catch((err: any) => {
                console.error('Could not write file to processed folder', err);
            });
        });
    });
    uploader.on('error', (err: any) => {
        console.log('Error!', err);
    });
    uploader.on('abort', (fileInfo: any) => {
        console.log('Aborted: ', fileInfo);
    });
};

let registerOnDeleteHandle = function (socket: WebSocket) {
    socket.on('delete', (data) => {
        // todo store passwords in database, hashed?
        if (data.token === token) {
            console.log('deleting: ' + data.image);
            let fullPath = 'data/processed/' + data.image;
            // todo use promise chaining
            fs.exists(fullPath).then((exists: boolean) => {
                if (exists) {
                    return fs.rename(fullPath, 'data/removed/' + data.image).then(() => {
                        return ws.clients().emit('imageDeleted', {name: data.image});
                    });
                } else {
                    console.error('Full path does not exist: ' + fullPath);
                }
            });
        } else {
            console.error('Tried to delete image with invalid token');
        }
    });
};

let sendCurrentImages = function (socket: WebSocket) {
    // read all current images on disk and sent them to client
    fs.readdir('data/processed').then((files: Array<string>) => {
        let images = files.filter(i => imageExtensions.indexOf(i.substring(i.lastIndexOf("."))) >= 0);
        console.log('Sending images: ', images);
        Promise.all(images.map(value => {
            let descriptionPath = 'data/processed/' + value + '_desc.txt';
            return fs.exists(descriptionPath).then((exists: boolean) => {
                return exists ? fs.readFile(descriptionPath, 'utf8') : '';
            }).then((description: string) => {
                return {
                    name: value,
                    description: description
                }
            })
        })).then(values => {
            socket.emit('images', values.sort((image1, image2) => image1.name.localeCompare(image2.name)));
        });
        // images.forEach(file => {
        //     let descriptionPath = 'data/processed/' + file + '_desc.txt';
        //     fs.exists(descriptionPath).then((exists: boolean) => {
        //         return exists ? fs.readFile(descriptionPath, 'utf8') : '';
        //     }).then((description: string) => {
        //         socket.emit('image',)
        //     });
        // });
    }).catch((error: ErrnoException) => {
        console.error('Could not sent the current images', error);
    });
};

// function to encode file data to base64 encoded string
let base64_encode_rotate = function (file: string): Promise<string> {
    return new Promise(function (resolve, reject) {
        fs.readFile('data/incoming/' + file, (err: any, data: Buffer) => {
            if (err) {
                reject(err);
            } else {
                resolve(data.toString('base64'))
            }
        });
    });
};

let rotate = function (file: string): Promise<Buffer> {
    return new Promise(function (resolve) {
        jo.rotate(file, options, function (error: any, buffer: Buffer, orientation: any, dimensions: any) {
            if (error) {
                // already proper orientation?
                // todo make it smaller over here!!
                console.log('An error occurred when rotating the file: ' + error.message);
                resolve(fs.readFileSync(file));
            } else {
                console.log('Orientation was: ' + orientation);
                console.log('Height after rotation: ' + dimensions.height);
                console.log('Width after rotation: ' + dimensions.width);
                resolve(buffer);
            }
        });
    });
};

function deleteThumbnailFromExif(imageBuffer: Buffer) {
    const imageString = imageBuffer.toString('binary');
    const exifObj = piexif.load(imageString);
    delete exifObj.thumbnail;
    delete exifObj['1st'];
    const exifBytes = piexif.dump(exifObj);
    const newImageString = piexif.insert(exifBytes, imageString);
    return Buffer.from(newImageString, 'binary')
}

app.use('/images', express.static('data/processed'));
app.use('/other', express.static('data/other'));

//start our server
imageServer.listen(3000, () => {
    console.log(`Image server started on port ${imageServer.address().port} :)`);
});
