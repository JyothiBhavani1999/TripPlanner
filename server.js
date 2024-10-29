const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 4000;
const dbURL = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(dbURL)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Could not connect to MongoDB:', err));

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
      lng: Number
    }
  ]
});

// Mongoose model for a Trip
const Trip = mongoose.model('Trip', tripSchema);

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle socket connections
io.on('connection', (socket) => {
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
        trip = new Trip({ tripId, destinationCity, destinationCountry, itinerary: [], markers: [] });
        await trip.save();
      }

      socket.join(tripId);
      socket.emit('updateItinerary', trip.itinerary);
      socket.emit('updateMarkers', trip.markers);
    } catch (err) {
      console.error(`Error joining trip: ${err.message}`);
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
          io.to(tripId).emit('updateItinerary', trip.itinerary);
        }
      }
    } catch (err) {
      console.error(`Error voting on item: ${err.message}`);
    }
  });

  // Handle adding a marker
  socket.on('addMarker', async ({ tripId, lat, lng }) => {
    try {
      const trip = await Trip.findOne({ tripId });
      if (trip) {
        trip.markers.push({ lat, lng });
        await trip.save();
        io.to(tripId).emit('updateMarkers', trip.markers);
      }
    } catch (err) {
      console.error(`Error adding marker to trip: ${err.message}`);
    }
  });

  // Handle sending messages
  socket.on('sendMessage', ({ tripId, username, message }) => {
    if (!tripId || !message) return;
    io.to(tripId).emit('receiveMessage', { username, message });
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
