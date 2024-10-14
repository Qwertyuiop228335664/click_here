const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.set('strictQuery', false);

mongoose.connect('mongodb+srv://neumyvaka:mndwZ4EZRs_RJEf@messaging.fce47.mongodb.net/?retryWrites=true&w=majority&appName=Messaging', {
  useNewUrlParser: true,
  useUnifiedTopology: true
});

const messageSchema = new mongoose.Schema({
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const Message = mongoose.model('Message', messageSchema);

// Serve static files from the current directory
app.use(express.static(__dirname));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

io.on('connection', (socket) => {
  console.log('a user connected');

  Message.find().then(messages => {
    socket.emit('chat history', messages);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  socket.on('chat message', (msg) => {
    const message = new Message({ content: msg });
    message.save().then(() => {
      console.log('Message saved:', msg);
      io.emit('chat message', msg);
    }).catch(err => {
      console.error('Error saving message:', err);
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
