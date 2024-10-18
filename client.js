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
    mainContent.style.display = 'flex'; // Use flex to display sections side by side
  }
});

// Handle adding an item to the itinerary
addItemBtn.addEventListener('click', () => {
  const item = itineraryInput.value.trim();
  if (item && currentTripId) {
    socket.emit('addItem', { tripId: currentTripId, item });
    itineraryInput.value = ''; // Clear the input after sending
  }
});

// Listen for updates to the itinerary from the server
socket.on('updateItinerary', (itinerary) => {
  itineraryList.innerHTML = ''; // Clear the existing list
  itinerary.forEach((item) => {
    if (item.name) {  // Ensure the item has a name
      const li = document.createElement('li');
      li.innerHTML = `
        ${item.name} - Liked by ${item.likes} users
        <button class="like-btn" data-item="${item.name}">Like</button>
      `;
      itineraryList.appendChild(li);
    }
  });

  // Add event listeners to the like buttons
  document.querySelectorAll('.like-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const itemName = event.target.getAttribute('data-item');
      socket.emit('likeItem', { tripId: currentTripId, itemName });
    });
  });
});

// Handle sending chat messages
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && currentTripId) {
    socket.emit('sendMessage', { tripId: currentTripId, message });
    chatInput.value = ''; // Clear the input after sending
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
