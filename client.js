const socket = io();

const tripSection = document.getElementById('trip-section');
const mainContent = document.getElementById('main-content');
const joinTripBtn = document.getElementById('join-trip-btn');
const addItemBtn = document.getElementById('add-item-btn');
const tripIdInput = document.getElementById('trip-id');
const usernameInput = document.getElementById('username');
const itineraryInput = document.getElementById('itinerary-input');
const itineraryList = document.getElementById('itinerary-list');

// Chat elements
const messagesList = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

let currentTripId = null;

// Handle joining a trip
joinTripBtn.addEventListener('click', () => {
  const tripId = tripIdInput.value.trim();
  const username = usernameInput.value.trim() || 'Anonymous';
  const destinationCity = document.getElementById('destination-city').value.trim();
  const destinationCountry = document.getElementById('destination-country').value.trim();

  if (tripId) {
    // Emit an event to check if the trip already exists
    socket.emit('checkTrip', { tripId }, (tripExists) => {
      if (tripExists) {
        // If the trip exists, join without asking for city/country
        currentTripId = tripId; // Set the current trip ID
        socket.emit('joinTrip', { tripId, username });
        tripSection.style.display = 'none';
        mainContent.style.display = 'flex'; // Display itinerary and chat
      } else {
        // If the trip doesn't exist, ensure that city and country are provided
        if (destinationCity && destinationCountry) {
          currentTripId = tripId; // Set the current trip ID for the new trip
          socket.emit('joinTrip', { tripId, username, destinationCity, destinationCountry });
          tripSection.style.display = 'none';
          mainContent.style.display = 'flex'; // Display itinerary and chat
        } else {
          alert('Please enter the destination city and country for the new trip.');
        }
      }
    });
  }
});

// Show city/country fields only when creating a new trip
tripIdInput.addEventListener('input', () => {
  const tripId = tripIdInput.value.trim();
  if (tripId) {
    // Ask server whether the trip exists
    socket.emit('checkTrip', { tripId }, (tripExists) => {
      const destinationSection = document.getElementById('destination-section');
      if (tripExists) {
        destinationSection.style.display = 'none';
      } else {
        destinationSection.style.display = 'block';
      }
    });
  }
});

// Handle adding an item to the itinerary
addItemBtn.addEventListener('click', () => {
  const item = itineraryInput.value.trim();
  if (item && currentTripId) {
    socket.emit('addItem', { tripId: currentTripId, item });
    itineraryInput.value = ''; // Clear input after sending
  } else {
    alert('Please join a trip before adding items.');
  }
});

// Listen for updates to the itinerary from the server
socket.on('updateItinerary', (itinerary) => {
  itineraryList.innerHTML = ''; // Clear the existing list
  itinerary.forEach((item) => {
    if (item.name) {
      const li = document.createElement('li');
      li.innerHTML = `
        ${item.name} - Upvotes: ${item.upvotes}, Downvotes: ${item.downvotes}
        <button class="upvote-btn" data-item="${item.name}">Upvote</button>
        <button class="downvote-btn" data-item="${item.name}">Downvote</button>
      `;
      itineraryList.appendChild(li);
    }
  });

  // Add event listeners to the upvote buttons
  document.querySelectorAll('.upvote-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const itemName = event.target.getAttribute('data-item');
      socket.emit('voteItem', { tripId: currentTripId, itemName, vote: 'upvote' });
    });
  });

  // Add event listeners to the downvote buttons
  document.querySelectorAll('.downvote-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const itemName = event.target.getAttribute('data-item');
      socket.emit('voteItem', { tripId: currentTripId, itemName, vote: 'downvote' });
    });
  });
});

// Handle sending chat messages
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && currentTripId) {
    socket.emit('sendMessage', { tripId: currentTripId, message });
    chatInput.value = ''; // Clear input after sending
  } else {
    alert('Please join a trip before sending messages.');
  }
});

// Listen for chat messages from the server
socket.on('receiveMessage', (data) => {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  messagesList.appendChild(li);

  // Scroll to the bottom of the chat window
  messagesList.scrollTop = messagesList.scrollHeight;
});
