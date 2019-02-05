import * as express from 'express';
import * as http from 'http';
import * as WebSocket from 'ws';
var fs = require('fs');
const app = express();

//initialize a simple http server
const server = http.createServer(app);

const imageServer = http.createServer(app);

//initialize the WebSocket server instance
const wss = new WebSocket.Server({ server });

// For the images
const io = require('socket.io')(imageServer);
const SocketIOFile = require('socket.io-file');

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
    ) { }
}

io.on('connection', (socket: WebSocket) => {
    console.log('Socket connected.');

    var uploader = new SocketIOFile(socket, {
        // uploadDir: {			// multiple directories
        // 	music: 'data/music',
        // 	document: 'data/document'
        // },
        uploadDir: 'data',							// simple directory
        accepts: ['image/jpeg', 'image/png'],		// chrome and some of browsers checking mp3 as 'audio/mp3', not 'audio/mpeg'
        maxFileSize: 4194304, 						// 4 MB. default is undefined(no limit)
        chunkSize: 10240,							// default is 10240(1KB)
        transmissionDelay: 0,						// delay of each transmission, higher value saves more cpu resources, lower upload speed. default is 0(no delay)
        overwrite: true 							// overwrite file if exists, default is true.
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
        console.log(fileInfo);
        console.log(io.clients());

        io.clients().emit('image', base64_encode(fileInfo.name))
    });
    uploader.on('error', (err: any) => {
        console.log('Error!', err);
    });
    uploader.on('abort', (fileInfo: any) => {
        console.log('Aborted: ', fileInfo);
    });
});

// function to encode file data to base64 encoded string
function base64_encode(file: string) {
    // read binary data
    var bitmap = fs.readFileSync('data/' + file);
    // convert binary data to base64 encoded string
    return new Buffer(bitmap).toString('base64');
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

            ws.send(createMessage(`You sent -> ${message.content}`, message.isBroadcast));

        }, 1000);

    });

    //send immediatly a feedback to the incoming connection    
    ws.send(createMessage('Hi there, I am a WebSocket server'));

    ws.on('error', (err) => {
        console.warn(`Client disconnected - reason: ${err}`);
    })
});

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
})