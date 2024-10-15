const socket = io();

const tripSection = document.getElementById('trip-section');
const itinerarySection = document.getElementById('itinerary-section');
const joinTripBtn = document.getElementById('join-trip-btn');
const addItemBtn = document.getElementById('add-item-btn');
const tripIdInput = document.getElementById('trip-id');
const itineraryInput = document.getElementById('itinerary-input');
const itineraryList = document.getElementById('itinerary-list');

let currentTripId = null;

// Handle joining a trip
joinTripBtn.addEventListener('click', () => {
  const tripId = tripIdInput.value;
  if (tripId) {
    currentTripId = tripId;
    socket.emit('joinTrip', tripId);
    tripSection.style.display = 'none';
    itinerarySection.style.display = 'block';
  }
});

// Handle adding an item to the itinerary
addItemBtn.addEventListener('click', () => {
  const item = itineraryInput.value;
  if (item && currentTripId) {
    socket.emit('addItem', { tripId: currentTripId, item });
    itineraryInput.value = ''; // Clear the input after sending
  }
});

// Listen for updates to the itinerary from the server
socket.on('updateItinerary', (itinerary) => {
  itineraryList.innerHTML = ''; // Clear the existing list
  itinerary.forEach((item) => {
    const li = document.createElement('li');
    li.textContent = item;
    itineraryList.appendChild(li);
  });
});
