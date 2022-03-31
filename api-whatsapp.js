const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
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
    authStrategy: new LocalAuth()
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

client.initialize();


//socket io
io.on('connection', function(socket) {
    socket.emit('message','Connecting....');

    // Save session values to the file upon successful auth
    client.on('authenticated', () => {
        socket.emit('message','Whatsapp is autenticated!');
    });

    client.on('qr', qr => {
        qrcode.toDataURL(qr, (req, res) => {
            socket.emit('qr',res);
            socket.emit('messageQr','QR Code is ready, Please scan!');
        })
    });
    
    client.on('ready', () => {
        socket.emit('hideQr','Client is ready');
        socket.emit('message','Whatsapp is ready to use!');
    });

    client.on('auth_failure', function() {
        socket.emit('message', 'Auth failure, restarting...');
    });
    
    client.on('disconnected', (reason) => {
        socket.emit('message', 'Whatsapp is disconnected!');
        client.destroy();
        client.initialize();
    });
}); 

server.listen(8000,function () {
    console.log('App running on port 8000');
});
