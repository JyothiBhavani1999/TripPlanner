// Import necessary modules
const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config(); // Load environment variables from .env file

// Create an Express app and an HTTP server
const app = express();
const server = http.createServer(app);
const io = socketIO(server);

// Set the port to 4000 or use environment variable
const PORT = process.env.PORT || 4000;

// MongoDB connection using environment variable from .env
const dbURL = process.env.MONGODB_URI;

// Connect to MongoDB
mongoose.connect(dbURL)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Could not connect to MongoDB:', err));

// Mongoose schema for a Trip
const tripSchema = new mongoose.Schema({
  tripId: { type: String, required: true, unique: true },
  itinerary: [
    {
      name: String,
      likes: { type: Number, default: 0 }
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

// Handle client connections via Socket.IO
io.on('connection', (socket) => {
  console.log('A user connected');

  // Store the username associated with this socket
  let username = 'Anonymous';

  // Handle when a user joins a trip
  socket.on('joinTrip', async ({ tripId, username: user }) => {
    if (!tripId) {
      return socket.emit('error', 'Invalid trip ID.');
    }

    console.log(`User joined trip: ${tripId}`);
    username = user || 'Anonymous';

    try {
      let trip = await Trip.findOne({ tripId });

      // If the trip doesn't exist, create a new one
      if (!trip) {
        trip = new Trip({ tripId, itinerary: [] });
        await trip.save();
        console.log(`Created a new trip with ID: ${tripId}`);
      }

      // Join the socket room for this trip
      socket.join(tripId);

      // Send the current itinerary to the user who joined
      socket.emit('updateItinerary', trip.itinerary);

    } catch (err) {
      console.error(`Error joining trip: ${err.message}`);
    }
  });

  // Handle adding an item to the itinerary
  socket.on('addItem', async ({ tripId, item }) => {
    if (!tripId || !item) {
      return socket.emit('error', 'Invalid trip ID or item.');
    }

    console.log(`Adding item to trip ${tripId}: ${item}`);

    try {
      const trip = await Trip.findOne({ tripId });

      if (trip) {
        // Add the item to the trip's itinerary with 0 likes
        trip.itinerary.push({ name: item, likes: 0 });

        // Save the updated trip to the database
        await trip.save();

        // Broadcast the updated itinerary to all users in the trip
        io.to(tripId).emit('updateItinerary', trip.itinerary);
      } else {
        console.error(`Trip with ID ${tripId} not found.`);
      }
    } catch (err) {
      console.error(`Error adding item to trip: ${err.message}`);
    }
  });

  // Handle receiving a chat message
  socket.on('sendMessage', ({ tripId, message }) => {
    if (!tripId || !message) {
      return;
    }

    console.log(`Message received in trip ${tripId}: ${message}`);

    // Broadcast the message to all users in the trip
    io.to(tripId).emit('receiveMessage', { username, message });
  });

  // Handle liking an item
  socket.on('likeItem', async ({ tripId, itemName }) => {
    if (!tripId || !itemName) {
      return socket.emit('error', 'Invalid trip ID or item name.');
    }

    console.log(`User liked item ${itemName} in trip ${tripId}`);

    try {
      const trip = await Trip.findOne({ tripId });

      if (trip) {
        // Find the item in the itinerary and increment its likes
        const item = trip.itinerary.find(i => i.name === itemName);
        if (item) {
          item.likes += 1;

          // Save the updated trip to the database
          await trip.save();

          // Broadcast the updated itinerary to all users in the trip
          io.to(tripId).emit('updateItinerary', trip.itinerary);
        } else {
          console.error(`Item ${itemName} not found in trip ${tripId}.`);
        }
      } else {
        console.error(`Trip with ID ${tripId} not found.`);
      }
    } catch (err) {
      console.error(`Error liking item: ${err.message}`);
    }
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
