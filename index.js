const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const app = express();
const httpServer = require("https").createServer({
  key: fs.readFileSync('path/to/key.pem'),
  cert: fs.readFileSync('path/to/cert.pem')
}, app);
const io = require("socket.io")(httpServer);

app.use(express.json());
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
}));

mongoose.set('strictQuery', false);

mongoose.connect('mongodb+srv://neumyvaka:mndwZ4EZRs_RJEf@messaging.fce47.mongodb.net/?retryWrites=true&w=majority&appName=Messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

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
httpServer.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});