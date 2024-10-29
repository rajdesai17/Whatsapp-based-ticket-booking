// server.js
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { MongoClient } = require('mongodb');
const { ObjectId } = require('mongodb');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: 'your-secret-key',
  resave: false,
  saveUninitialized: true
}));

// MongoDB connection
const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function connectDB() {
  await client.connect();
  return client.db("museum_booking");
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/index.html');
});

app.post('/register', async (req, res) => {
    const { museumName, email, password } = req.body;
    const db = await connectDB();
    const hashedPassword = await bcrypt.hash(password, 10);
    
    try {
      await db.collection('museums').insertOne({
        museumName,
        email,
        password: hashedPassword,
        ticketPrice: 10 // Default price
      });
      res.json({ success: true, message: 'Registration successful' });
    } catch (error) {
      res.status(400).json({ success: false, message: 'Registration failed' });
    }
  });
  
  app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    const db = await connectDB();
    const museum = await db.collection('museums').findOne({ email });
    
    if (museum && await bcrypt.compare(password, museum.password)) {
      req.session.museumId = museum._id.toString(); // Convert ObjectId to string
      console.log('Logged in museumId:', req.session.museumId); // Debug log
      res.json({ success: true, message: 'Login successful' });
    } else {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
  });

  app.get('/api/museum-info', async (req, res) => {
    if (!req.session.museumId) return res.status(401).send('Unauthorized');
    
    const db = await connectDB();
    console.log('Searching for museum with _id:', req.session.museumId); // Debug log
    const museum = await db.collection('museums').findOne({ _id: new ObjectId(req.session.museumId) });
    
    if (!museum) {
      console.log('Museum not found'); // Debug log
      return res.status(404).json({ error: 'Museum not found' });
    }
    
    console.log('Museum found:', museum); // Debug log
    res.json({ museumName: museum.museumName, ticketPrice: museum.ticketPrice });
  });

 app.post('/api/update-price', async (req, res) => {
  if (!req.session.museumId) return res.status(401).send('Unauthorized');
  
  const { newPrice } = req.body;
  const db = await connectDB();
  await db.collection('museums').updateOne(
    { _id: new ObjectId(req.session.museumId) },
    { $set: { ticketPrice: parseFloat(newPrice) } }
  );
  res.json({ success: true });
});

app.get('/api/bookings', async (req, res) => {
  if (!req.session.museumId) return res.status(401).send('Unauthorized');
  
  const db = await connectDB();
  const bookings = await db.collection('bookings')
    .find({ museumId: new ObjectId(req.session.museumId) })
    .sort({ date: -1 })
    .limit(100)
    .toArray();
  
  res.json(bookings);
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});