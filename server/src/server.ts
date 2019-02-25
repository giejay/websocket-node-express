import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
// @ts-ignore
import piexif from 'piexifjs'
import ErrnoException = NodeJS.ErrnoException;

var fs = require('fs');
const app = express();

//initialize a simple http server
const server = http.createServer(app);

const imageServer = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({server});

// For the images
const io = require('socket.io')(imageServer);
const SocketIOFile = require('socket.io-file');
const jo = require('jpeg-autorotate');
const options = {quality: 65};

interface ExtWebSocket extends WebSocket {
    isAlive: boolean;
}

function createMessage(content: string, isBroadcast = false, sender = 'NS'): string {
    return JSON.stringify(new Message(content, isBroadcast, sender));
}

export class Message {
    constructor(
        public content: string,
        public isBroadcast = false,
        public sender: string
    ) {
    }
}

io.on('connection', (socket: WebSocket) => {
    console.log('Socket connected.');

    fs.readdir('data/processed', (error: ErrnoException, buffers: Array<string>) => {
        console.log('Sending images: ', buffers);
        buffers.forEach(file => socket.emit('image', fs.readFileSync('data/processed/' + file).toString('base64')));
    });

    var uploader = new SocketIOFile(socket, {
        // uploadDir: {			// multiple directories
        // 	music: 'data/music',
        // 	document: 'data/document'
        // },
        uploadDir: 'data/incoming',							// simple directory
        accepts: ['image/jpeg', 'image/png'],		// chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
        maxFileSize: 6194304, 						// 4 MB. default is undefined(no limit)
        chunkSize: 10240,							// default is 10240(1KB)
        transmissionDelay: 0,						// delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: true 		,					// overwrite file if exists, default is true.
        rename: function(filename: string, fileInfo: string){
            return (new Date().getTime() + Math.floor(Math.random() * 10000000)).toString();
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
            io.clients().emit('image', base64Image)
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

    return new Promise(function (resolve, reject) {
        jo.rotate(bitmap, options, function (error: any, buffer: Buffer, orientation: any, dimensions: any) {
            if (error) {
                buffer = bitmap;
                // todo make it smaller over here!!
                console.log('An error occurred when rotating the file: ' + error.message)
            } else {
                console.log('Orientation was: ' + orientation)
                console.log('Height after rotation: ' + dimensions.height)
                console.log('Width after rotation: ' + dimensions.width)
                // ...
                // Do whatever you need with the resulting buffer
                // ...
            }
            fs.writeFileSync('data/processed/' + file, buffer);
            resolve(buffer.toString('base64'));
        });
    });
}

wss.on('connection', (ws: WebSocket) => {

    const extWs = ws as ExtWebSocket;

    extWs.isAlive = true;

    ws.on('pong', () => {
        extWs.isAlive = true;
    });

    //connection is up, let's add a simple simple event
    ws.on('message', (msg: string) => {

        const message = JSON.parse(msg) as Message;

        setTimeout(() => {
            if (message.isBroadcast) {

                //send back the message to the other clients
                wss.clients
                    .forEach(client => {
                        if (client != ws) {
                            client.send(createMessage(message.content, true, message.sender));
                        }
                    });

            }

            ws.send(createMessage(`You sent 2 -> ${message.content}`, message.isBroadcast));

        }, 1000);

    });

    //send immediatly a feedback to the incoming connection    
    ws.send(createMessage('Hi there, I am a WebSocket server'));

    ws.on('error', (err) => {
        console.warn(`Client disconnected - reason: ${err}`);
    })
});

function deleteThumbnailFromExif(imageBuffer: Buffer) {
    const imageString = imageBuffer.toString('binary')
    const exifObj = piexif.load(imageString)
    delete exifObj.thumbnail
    delete exifObj['1st']
    const exifBytes = piexif.dump(exifObj)
    const newImageString = piexif.insert(exifBytes, imageString)
    return Buffer.from(newImageString, 'binary')
}

setInterval(() => {
    wss.clients.forEach((ws: WebSocket) => {

        const extWs = ws as ExtWebSocket;

        if (!extWs.isAlive) return ws.terminate();

        extWs.isAlive = false;
        ws.ping(null, undefined);
    });
}, 10000);

//start our server
server.listen(process.env.PORT || 8999, () => {
    console.log(`Server started on port ${server.address().port} :)`);
});

imageServer.listen(3000, () => {
    console.log(`Image server started on port ${imageServer.address().port} :)`);
});