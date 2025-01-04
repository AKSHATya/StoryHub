import cors from 'cors';
import mongoose from 'mongoose';
import User from './models/User.js';
import Post from './models/Post.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import express from 'express';

// Initialize Express app
const app = express();

// File upload configuration
const uploadMiddleware = multer({ dest: 'uploads/' });

// Constants for password hashing and JWT secret
const salt = bcrypt.genSaltSync(10);
const secret = 'secret_key'; // Replace with an environment variable in production

// Middlewares
app.use(cors({ credentials: true, origin: 'http://localhost:3000' }));
app.use(express.json());
app.use(cookieParser());
app.use('/uploads', express.static(path.join(path.resolve(), 'uploads')));

// MongoDB Connection
// const MONGO_URL = 'mongodb://127.0.0.1:27017/Story'; 
// mongoose.connect(MONGO_URL, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
// })
//   .then(() => console.log('Connected to MongoDB'))
//   .catch((error) => console.error('Error connecting to MongoDB:', error.message));
mongoose.connect('mongodb+srv://akshaty961:j.iCHPbsU6629X-@suretrust.jee2d.mongodb.net/?retryWrites=true&w=majority&appName=suretrust')
  .then(() => console.log('Connected to MongoDB'))
  .catch((error) => console.error('Error connecting to MongoDB:', error.message));


// Routes

// User Registration
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  try {
    const hashedPassword = bcrypt.hashSync(password, salt);
    const userDoc = await User.create({ username, password: hashedPassword });
    res.json(userDoc);
  } catch (error) {
    console.error(error);
    res.status(400).json(error.message);
  }
});

// User Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const userDoc = await User.findOne({ username });
    if (!userDoc) return res.status(400).json('Invalid credentials');

    const passOk = bcrypt.compareSync(password, userDoc.password);
    if (!passOk) return res.status(400).json('Invalid credentials');

    jwt.sign({ username, id: userDoc._id }, secret, {}, (err, token) => {
      if (err) throw err;
      res.cookie('token', token).json({ id: userDoc._id, username });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

// Get User Profile
app.get('/profile', (req, res) => {
  const { token } = req.cookies;
  jwt.verify(token, secret, {}, (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    res.json(info);
  });
});

// Logout
app.post('/logout', (req, res) => {
  res.cookie('token', '').json('Logged out');
});

// Create Post
app.post('/post', uploadMiddleware.single('file'), async (req, res) => {
  const { originalname } = req.file;
  const ext = originalname.split('.').pop();
  const newPath = `${req.file.path}.${ext}`;
  fs.renameSync(req.file.path, newPath);

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const { title, summary, content } = req.body;
    try {
      const postDoc = await Post.create({
        title,
        summary,
        content,
        cover: newPath,
        author: info.id,
      });
      res.json(postDoc);
    } catch (error) {
      console.error(error);
      res.status(500).json('Internal server error');
    }
  });
});

// Update Post
app.put('/post', uploadMiddleware.single('file'), async (req, res) => {
  let newPath = null;
  if (req.file) {
    const { originalname, path: filePath } = req.file;
    const ext = originalname.split('.').pop();
    newPath = `${filePath}.${ext}`;
    fs.renameSync(filePath, newPath);
  }

  const { token } = req.cookies;
  jwt.verify(token, secret, {}, async (err, info) => {
    if (err) return res.status(401).json('Unauthorized');
    const { id, title, summary, content } = req.body;

    try {
      const postDoc = await Post.findById(id);
      if (String(postDoc.author) !== String(info.id)) {
        return res.status(403).json('You are not the author');
      }
      postDoc.title = title;
      postDoc.summary = summary;
      postDoc.content = content;
      postDoc.cover = newPath || postDoc.cover;
      await postDoc.save();
      res.json(postDoc);
    } catch (error) {
      console.error(error);
      res.status(500).json('Internal server error');
    }
  });
});

// Get Posts
app.get('/post', async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', ['username'])
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

// Get Post by ID
app.get('/post/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const postDoc = await Post.findById(id).populate('author', ['username']);
    res.json(postDoc);
  } catch (error) {
    console.error(error);
    res.status(500).json('Internal server error');
  }
});

// Start Server
app.listen(4000, () => {
  console.log('Server running on http://localhost:4000');
});