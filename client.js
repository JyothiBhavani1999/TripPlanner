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
  if (tripId) {
    currentTripId = tripId;
    socket.emit('joinTrip', { tripId, username });
    tripSection.style.display = 'none';
    mainContent.style.display = 'flex'; // Display itinerary and chat
  }
});

// Handle adding an item to the itinerary
addItemBtn.addEventListener('click', () => {
  const item = itineraryInput.value.trim();
  if (item && currentTripId) {
    socket.emit('addItem', { tripId: currentTripId, item });
    itineraryInput.value = ''; // Clear input after sending
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
