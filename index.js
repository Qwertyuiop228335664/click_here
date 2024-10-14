const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const fs = require('fs');
const https = require('https');

// Настройка HTTPS сервера
const httpsOptions = {
  key: fs.readFileSync('path/to/key.pem'),  // Замените на путь к вашему ключу
  cert: fs.readFileSync('path/to/cert.pem')  // Замените на путь к вашему сертификату
};
const httpsServer = https.createServer(httpsOptions, app);
const io = require("socket.io")(httpsServer);

app.use(express.json());
app.use(session({
  secret: 'your-secret-key',  // Замените на случайную строку
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

mongoose.set('strictQuery', false);

mongoose.connect('mongodb+srv://neumyvaka:mndwZ4EZRs_RJEf@messaging.fce47.mongodb.net/?retryWrites=true&w=majority&appName=Messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Подключено к MongoDB');
  createUsers();  // Создаем пользователей после подключения к базе данных
}).catch(err => console.error('Ошибка подключения к MongoDB:', err));

const messageSchema = new mongoose.Schema({
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

const userSchema = new mongoose.Schema({
  username: String,
  password: String
});

const User = mongoose.model('User', userSchema);

async function createUsers() {
  const users = [
    { username: 'sus', password: 'semen' },
    { username: 'admin', password: 'nimda' }
  ];

  for (const user of users) {
    try {
      const existingUser = await User.findOne({ username: user.username });
      if (existingUser) {
        console.log(`Пользователь ${user.username} уже существует`);
        continue;
      }

      const hashedPassword = await bcrypt.hash(user.password, 10);
      const newUser = new User({
        username: user.username,
        password: hashedPassword
      });

      await newUser.save();
      console.log(`Пользователь ${user.username} успешно создан`);
    } catch (error) {
      console.error(`Ошибка при создании пользователя ${user.username}:`, error);
    }
  }
}

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
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ success: false, message: 'Error logging out' });
    } else {
      res.json({ success: true });
    }
  });
});

io.use((socket, next) => {
  const session = socket.request.session;
  if (session && session.user) {
    next();
  } else {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', async (socket) => {
  console.log('a user connected');

  try {
    const messages = await Message.find().sort('-timestamp').limit(50);
    socket.emit('chat history', messages.reverse());
  } catch (err) {
    console.error('Error fetching chat history:', err);
  }

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('chat message', async (msg) => {
    const message = new Message({ content: msg });
    try {
      await message.save();
      console.log('Message saved:', msg);
      io.emit('chat message', { content: msg, timestamp: message.timestamp });
    } catch (err) {
      console.error('Error saving message:', err);
    }
  });
});

const PORT = process.env.PORT || 3000;
httpsServer.listen(PORT, () => {
  console.log(`HTTPS сервер запущен на порту ${PORT}`);
});