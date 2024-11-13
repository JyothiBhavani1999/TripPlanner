const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

// Session and authentication packages
const session = require('express-session');
const bcrypt = require('bcrypt');

// Mongoose User schema for authentication
const User = mongoose.model('User', new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  email: { type: String, required: true, unique: true }
}));

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 4000;
const dbURL = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(dbURL)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Could not connect to MongoDB:', err));

// Session middleware setup
app.use(session({
  secret: 'your_secret_key', // Replace with a secure key
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false } // Use true in production with HTTPS
}));

// Body parser for JSON
app.use(express.json());

// Mongoose schema for a Trip
const tripSchema = new mongoose.Schema({
  tripId: { type: String, required: true, unique: true },
  destinationCity: { type: String, required: false },
  destinationCountry: { type: String, required: false },
  itinerary: [
    {
      name: String,
      upvotes: { type: Number, default: 0 },
      downvotes: { type: Number, default: 0 }
    }
  ],
  markers: [
    {
      lat: Number,
      lng: Number,
      description: String
    }
  ],
  mapCenter: { lat: Number, lng: Number }, // New field for map center
  zoomLevel: { type: Number, default: 4 }  // New field for zoom level
});

// Mongoose model for a Trip
const Trip = mongoose.model('Trip', tripSchema);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Signup route
app.post('/signup', express.json(), async (req, res) => {
  const { username, password, email } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  try {
    const user = new User({ username, password: hashedPassword, email });
    await user.save();
    req.session.username = username;
    res.status(201).send('Signup successful');
  } catch (err) {
    if (err.code === 11000) { // MongoDB duplicate key error code
      res.status(400).send('Signup failed: Username or email already exists');
    } else {
      console.error('Error during signup:', err);
      res.status(500).send('Signup failed');
    }
  }
});

// Login route
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username });
    if (user && await bcrypt.compare(password, user.password)) {
      req.session.username = username;
      res.status(200).send('Login successful');
    } else {
      res.status(401).send('Login failed');
    }
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// Middleware to check if user is logged in
function isAuthenticated(req, res, next) {
  if (req.session.username) return next();
  res.status(401).send('Please log in');
}

// Join a trip without re-entering username
app.post('/join-trip', isAuthenticated, async (req, res) => {
  const { tripId, destinationCity, destinationCountry } = req.body;
  const username = req.session.username;

  if (!tripId) return res.status(400).send('Trip ID is required');

  try {
    let trip = await Trip.findOne({ tripId });
    if (!trip) {
      if (!destinationCity || !destinationCountry) {
        return res.status(400).send('New trips must include a destination city and country');
      }
      
      // Set initial map center and zoom
      const initialCenter = destinationCity === 'N/A' ? { lat: 20.5937, lng: 78.9629 } : { lat: 37.0902, lng: -95.7129 };
      const initialZoom = destinationCity === 'N/A' ? 4 : 6;

      trip = new Trip({
        tripId,
        destinationCity,
        destinationCountry,
        itinerary: [],
        markers: [],
        mapCenter: initialCenter,
        zoomLevel: initialZoom
      });
      await trip.save();
    }

    res.status(200).send(`Joined trip: ${tripId} as ${username}`);
  } catch (err) {
    res.status(500).send('Error joining trip: ' + err.message);
  }
});

// Socket.io connections
io.on('connection', (socket) => {
  console.log('New client connected');

  // Check if a trip exists
  socket.on('checkTrip', async ({ tripId }, callback) => {
    try {
      const trip = await Trip.findOne({ tripId });
      callback(trip !== null);
    } catch (err) {
      console.error('Error checking trip existence:', err.message);
      callback(false);
    }
  });

  // Join a trip
  socket.on('joinTrip', async ({ tripId, username, destinationCity, destinationCountry }) => {
    if (!tripId) return socket.emit('error', 'Invalid trip ID.');

    try {
      let trip = await Trip.findOne({ tripId });
      if (!trip) {
        if (!destinationCity || !destinationCountry) {
          return socket.emit('error', 'New trips must include a destination city and country.');
        }

        // Set initial map center and zoom
        const initialCenter = destinationCity === 'N/A' ? { lat: 20.5937, lng: 78.9629 } : { lat: 37.0902, lng: -95.7129 };
        const initialZoom = destinationCity === 'N/A' ? 4 : 6;

        trip = new Trip({
          tripId,
          destinationCity,
          destinationCountry,
          itinerary: [],
          markers: [],
          mapCenter: initialCenter,
          zoomLevel: initialZoom
        });
        await trip.save();
      }

      socket.join(tripId);
      socket.emit('updateItinerary', trip.itinerary);
      socket.emit('updateMarkers', trip.markers);
      socket.emit('centerMap', { lat: trip.mapCenter.lat, lng: trip.mapCenter.lng, zoom: trip.zoomLevel });
      console.log(`Joined trip: ${tripId} with username: ${username}`);
    } catch (err) {
      console.error(`Error joining trip: ${err.message}`);
    }
  });

  // Save the map's center and zoom level
  socket.on('saveMapCenter', async ({ tripId, lat, lng, zoom }) => {
    try {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        trip.mapCenter = { lat, lng };
        trip.zoomLevel = zoom;
        await trip.save();
      }
    } catch (err) {
      console.error(`Error saving map center: ${err.message}`);
    }
  });

  // Add an item to the itinerary
  socket.on('addItem', async ({ tripId, item }) => {
    try {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        trip.itinerary.push({ name: item, upvotes: 0, downvotes: 0 });
        await trip.save();
        io.to(tripId).emit('updateItinerary', trip.itinerary);
      }
      console.log(`Added item: ${item} to trip: ${tripId}`);
    } catch (err) {
      console.error(`Error adding item to trip: ${err.message}`);
    }
  });

  // Handle voting on an item
  socket.on('voteItem', async ({ tripId, itemName, vote }) => {
    try {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        const item = trip.itinerary.find(i => i.name === itemName);
        if (item) {
          if (vote === 'upvote') {
            item.upvotes += 1;
          } else if (vote === 'downvote') {
            item.downvotes += 1;
          }
          await trip.save();
          io.to(tripId).emit('updateVotes', item);
        }
      }
    } catch (err) {
      console.error(`Error voting on item: ${err.message}`);
    }
  });

  // Handle adding a marker
  socket.on('addMarker', async ({ tripId, lat, lng, description }) => {
    try {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        trip.markers.push({ lat, lng, description });
        await trip.save();
        io.to(tripId).emit('updateMarkers', trip.markers);
      }
    } catch (err) {
      console.error(`Error adding marker to trip: ${err.message}`);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', ({ tripId, username, message }) => {
    console.log("Received message from:", username); // Add this line for debugging
    if (tripId && username && message) {
      io.to(tripId).emit('receiveMessage', { username, message });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
