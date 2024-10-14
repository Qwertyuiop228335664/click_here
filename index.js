const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Убедитесь, что это правильно настроено для вашего окружения
}));

mongoose.set('strictQuery', false);
mongoose.connect('mongodb+srv://<username>:<password>@messaging.fce47.mongodb.net/?retryWrites=true&w=majority&appName=Messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Подключено к MongoDB');
  createUsers(); // Создаем пользователей после подключения к базе данных
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
      res.status(401).json({ success: false, message: 'Неверные учетные данные' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Ошибка сервера' });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      res.status(500).json({ success: false, message: 'Ошибка при выходе' });
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
  console.log('Пользователь подключен');

  try {
    const messages = await Message.find().sort('-timestamp').limit(50);
    socket.emit('chat history', messages.reverse());
  } catch (err) {
    console.error('Ошибка при получении истории чата:', err);
  }

  socket.on('chat message', async (msg) => {
    const message = new Message({ content: msg });
    await message.save();
    io.emit('chat message', message);
  });

  socket.on('disconnect', () => {
    console.log('Пользователь отключен');
  });
});

server.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});