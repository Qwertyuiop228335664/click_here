const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const https = require('https');
const fs = require('fs');

// Загрузка сертификатов
const privateKey = fs.readFileSync('server.key', 'utf8');
const certificate = fs.readFileSync('server.cert', 'utf8');

const credentials = { key: privateKey, cert: certificate };

const app = express();
const server = https.createServer(credentials, app);
const io = socketIo(server);

app.use(express.json());
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

mongoose.connect('mongodb+srv://neumyvaka:mndwZ4EZRs_RJEf@messaging.fce47.mongodb.net/?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Подключено к MongoDB');
}).catch(err => console.error('Ошибка подключения к MongoDB:', err));

const messageSchema = new mongoose.Schema({
    content: String,
    timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

app.use(express.static(__dirname));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const user = await User.findOne({ username });
        if (user && await bcrypt.compare(password, user.password)) {
            req.session.user = username;
            res.json({ success: true });
        } else {
            res.status(401).json({ success: false, message: 'Неверные учетные данные' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Ошибка сервера' });
    }
});

io.on('connection', async (socket) => {
    console.log('Пользователь подключен');

    socket.on('chat message', async (msg) => {
        const message = new Message({ content: msg });
        await message.save();
        io.emit('chat message', message);
    });

    socket.on('disconnect', () => {
        console.log('Пользователь отключен');
    });
});

// Запуск сервера на порту 3000
server.listen(3000, () => {
    console.log('Сервер запущен на https://localhost:3000');
});