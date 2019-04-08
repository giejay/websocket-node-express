import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
// @ts-ignore
import piexif from 'piexifjs'
import ErrnoException = NodeJS.ErrnoException;

var fs = require('fs');
const app = express();

// Websocket server
const imageServer = http.createServer(app);
const ws = require('socket.io')(imageServer);
const SocketIOFile = require('socket.io-file');
const jo = require('jpeg-autorotate');
const options = {quality: 65};

interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
}

ws.on('connection', (socket: WebSocket) => {

    const extWs = ws as ExtWebSocket;

    extWs.isAlive = true;

    ws.on('pong', () => {
        extWs.isAlive = true;
    });

    console.log('Socket connected.');

    // read all current images on disk and sent them to client
    fs.readdir('data/processed', (error: ErrnoException, images: Array<string>) => {
        console.log('Sending images: ', images);
        images.forEach(file => socket.emit('image', {name: file, content: fs.readFileSync('data/processed/' + file).toString('base64')}));
    });

    let counter = 0;

    const uploader = new SocketIOFile(socket, {
        // uploadDir: {			// multiple directories
        // 	music: 'data/music',
        // 	document: 'data/document'
        // },
        uploadDir: 'data/incoming',							// simple directory
        accepts: ['image/jpeg', 'image/png'],		// chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
        maxFileSize: 6194304, 						// 4 MB. default is undefined(no limit)
        chunkSize: 100240,							// default is 10240(1KB)
        transmissionDelay: 0,						// delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: true 		,					// overwrite file if exists, default is true.
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
        console.log('Upload Complete.');

        base64_encode(fileInfo.name).then((base64Image: string) => {
            ws.clients().emit('image', {name: fileInfo.name, content: base64Image})
        })
    });
    uploader.on('error', (err: any) => {
        console.log('Error!', err);
    });
    uploader.on('abort', (fileInfo: any) => {
        console.log('Aborted: ', fileInfo);
    });
});

// function to encode file data to base64 encoded string
function base64_encode(file: string): Promise<string> {
    // read binary data
    const bitmap = fs.readFileSync('data/incoming/' + file);
    // const withoutThumb = deleteThumbnailFromExif(bitmap);

    return new Promise(function (resolve) {
        jo.rotate(bitmap, options, function (error: any, buffer: Buffer, orientation: any, dimensions: any) {
            if (error) {
                // already proper orientation?
                buffer = bitmap;
                // todo make it smaller over here!!
                console.log('An error occurred when rotating the file: ' + error.message)
            } else {
                console.log('Orientation was: ' + orientation);
                console.log('Height after rotation: ' + dimensions.height);
                console.log('Width after rotation: ' + dimensions.width);
                // ...
                // Do whatever you need with the resulting buffer
                // ...
            }
            fs.writeFileSync('data/processed/' + file, buffer);
            resolve(buffer.toString('base64'));
        });
    });
}


function deleteThumbnailFromExif(imageBuffer: Buffer) {
    const imageString = imageBuffer.toString('binary');
    const exifObj = piexif.load(imageString);
    delete exifObj.thumbnail;
    delete exifObj['1st'];
    const exifBytes = piexif.dump(exifObj);
    const newImageString = piexif.insert(exifBytes, imageString);
    return Buffer.from(newImageString, 'binary')
}

// setInterval(() => {
//     Object.keys(ws.clients().sockets).map(key => ws.clients().sockets[key]).forEach((ws: WebSocket) => {
//
//         const extWs = ws as ExtWebSocket;
//
//         if (!extWs.isAlive) return ws.terminate();
//
//         extWs.isAlive = false;
//         ws.ping(null, undefined);
//     });
// }, 10000);

//start our server
imageServer.listen(3000, () => {
    console.log(`Image server started on port ${imageServer.address().port} :)`);
});