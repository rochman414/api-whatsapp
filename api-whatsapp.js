const express = require('express');
const { response, json } = require('express');
const { Client } = require('whatsapp-web.js');
const fs = require('fs');
const qrcode = require('qrcode');
const http = require('http');
const socketIO = require('socket.io');

const app       = express();
const server    = http.createServer(app);
const io        = socketIO(server);

app.use(express.json());
app.use(express.urlencoded({
  extended: true
}));

// Load the session data if it has been previously saved
const SESSION_FILE_PATH = './session.json'
let sessionData;
if(fs.existsSync(SESSION_FILE_PATH)) {
    sessionData = require(SESSION_FILE_PATH);
}

// Use the saved values

const client = new Client({
    restartOnAuthFail: true,
    puppeteer: {
    headless: true,
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process', // <- this one doesn't works in Windows
        '--disable-gpu'
    ],
    },
    session: sessionData
});

app.get('/',(req, res) => {
    res.sendFile('index.html',{root: __dirname});
});

app.get('/api/send-message/:nomer/:message', (req, res) => { 
    const number = req.params.nomer + '@c.us';
    const message = req.params.message;

    client.sendMessage(number,message).then(response => {
        res.status(200).json({
            status: true,
            response: response
        })
    }).catch(err => {
        res.status(500).json({
            status: false,
        })
    })
})

app.get('/delete',(req, res) => {
    if(fs.existsSync(SESSION_FILE_PATH)) {
        fs.unlinkSync(SESSION_FILE_PATH);
    } else {
        res.send('session deleted! \n Back to main menu');
    }
    process.exit(1);
});

client.initialize();


//socket io
io.on('connection', function(socket) {
    socket.emit('message','Connecting....');

    // Save session values to the file upon successful auth
    client.on('authenticated', (session) => {
        socket.emit('message','Whatsapp is autenticated!')
        sessionData = session;
        fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), (err) => {
            if (err) {
                console.error(err);
            }
        });
    });

    client.on('qr', qr => {
        qrcode.toDataURL(qr, (req, res) => {
            socket.emit('qr',res);
            console.log(res);
            socket.emit('messageQr','QR Code is ready, Please scan!');
        })
    });
    
    client.on('ready', () => {
        console.log('Client is ready!');
        socket.emit('hideQr','Client is ready');
        socket.emit('message','Whatsapp is ready to use!');
    });

    client.on('auth_failure', function(session) {
        socket.emit('message', 'Auth failure, restarting...');
    });
    
    client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');
        fs.unlinkSync(SESSION_FILE_PATH, function(err) {
            if(err) return console.log(err);
            console.log('Session file deleted!');
        });
        client.destroy();
        client.initialize();
    });
}); 

server.listen(8000,function () {
    console.log('App running on port 8000');
});