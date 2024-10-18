const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

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
  ]
});

// Mongoose model for a Trip
const Trip = mongoose.model('Trip', tripSchema);

// Serve static files (e.g., client.js, styles) from the project directory
app.use(express.static(path.join(__dirname)));

// Serve the index.html file when the root URL is accessed
app.get('/', (req, res) => {
  console.log("Serving the index.html file...");
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle checking if a trip exists
io.on('connection', (socket) => {
  socket.on('checkTrip', async ({ tripId }, callback) => {
    try {
      const trip = await Trip.findOne({ tripId });
      callback(trip !== null);
    } catch (err) {
      console.error('Error checking trip existence:', err.message);
      callback(false);
    }
  });

  // Handle when a user joins a trip
  socket.on('joinTrip', async ({ tripId, username: user, destinationCity, destinationCountry }) => {
    if (!tripId) return socket.emit('error', 'Invalid trip ID.');
    username = user || 'Anonymous';
    console.log(`User joined trip: ${tripId}`);

    try {
      let trip = await Trip.findOne({ tripId });
      if (!trip) {
        // If the trip doesn't exist, create it with the city and country
        if (!destinationCity || !destinationCountry) {
          return socket.emit('error', 'New trips must include a destination city and country.');
        }
        trip = new Trip({ tripId, itinerary: [], destinationCity, destinationCountry });
        await trip.save();
        console.log(`Created a new trip with ID: ${tripId} and destination: ${destinationCity}, ${destinationCountry}`);
      }

      // Join the trip and emit the itinerary
      socket.join(tripId);
      socket.emit('updateItinerary', trip.itinerary);
    } catch (err) {
      console.error(`Error joining trip: ${err.message}`);
    }
  });

  // Handle adding an item to the itinerary
  socket.on('addItem', async ({ tripId, item }) => {
    if (!tripId || !item) return socket.emit('error', 'Invalid trip ID or item.');
    console.log(`Adding item to trip ${tripId}: ${item}`);

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
    if (!tripId || !itemName || !vote) return socket.emit('error', 'Invalid voting data.');

    console.log(`User voted ${vote} on item ${itemName} in trip ${tripId}`);

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
        } else {
          console.error(`Item ${itemName} not found in trip ${tripId}.`);
        }
      }
    } catch (err) {
      console.error(`Error voting on item: ${err.message}`);
    }
  });

  // Handle receiving a chat message
  socket.on('sendMessage', ({ tripId, message }) => {
    if (!tripId || !message) return;
    console.log(`Message received in trip ${tripId}: ${message}`);
    io.to(tripId).emit('receiveMessage', { username, message });
  });

  // Handle user disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Start the server and listen on the specified port
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
