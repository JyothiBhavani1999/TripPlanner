const socket = io();

const tripSection = document.getElementById('trip-section');
const mainContent = document.getElementById('main-content');
const joinTripBtn = document.getElementById('join-trip-btn');
const addItemBtn = document.getElementById('add-item-btn');
const tripIdInput = document.getElementById('trip-id');
const usernameInput = document.getElementById('username');
const itineraryInput = document.getElementById('itinerary-input');
const itineraryList = document.getElementById('itinerary-list');
const mapElement = document.getElementById('map');

// Chat elements
const messagesList = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

let map;
let markers = [];
let currentTripId = null;
let currentUsername = null;

// Initialize Google Map when called
function initMap() {
  map = new google.maps.Map(mapElement, {
    center: { lat: 0, lng: 0 },
    zoom: 2
  });

  // Add marker on map click
  map.addListener('click', (e) => {
    const latLng = e.latLng;
    const marker = new google.maps.Marker({
      position: latLng,
      map: map
    });
    markers.push(marker);

    // Emit marker data to the server
    if (currentTripId) {
      socket.emit('addMarker', { tripId: currentTripId, lat: latLng.lat(), lng: latLng.lng() });
    }
  });
}

// Handle joining a trip
joinTripBtn.addEventListener('click', () => {
  const tripId = tripIdInput.value.trim();
  currentUsername = usernameInput.value.trim() || 'Anonymous';
  const destinationCity = document.getElementById('destination-city').value.trim();
  const destinationCountry = document.getElementById('destination-country').value.trim();

  if (tripId) {
    socket.emit('checkTrip', { tripId }, (tripExists) => {
      if (tripExists) {
        currentTripId = tripId;
        socket.emit('joinTrip', { tripId, username: currentUsername });
        displayMainContent(); // Show the main content including the map
      } else {
        if (destinationCity && destinationCountry) {
          currentTripId = tripId;
          socket.emit('joinTrip', { tripId, username: currentUsername, destinationCity, destinationCountry });
          displayMainContent(); // Show the main content including the map
        } else {
          alert('Please enter the destination city and country for the new trip.');
        }
      }
    });
  }
});

// Show the main content, including the map
function displayMainContent() {
  tripSection.style.display = 'none';
  mainContent.style.display = 'flex';
  mapElement.style.display = 'block'; // Show the map container

  // Ensure the map is initialized and displayed properly
  if (!map) {
    initMap();
  } else {
    google.maps.event.trigger(map, 'resize');
  }
}

// Show city/country fields only when creating a new trip
tripIdInput.addEventListener('input', () => {
  const tripId = tripIdInput.value.trim();
  if (tripId) {
    socket.emit('checkTrip', { tripId }, (tripExists) => {
      const destinationSection = document.getElementById('destination-section');
      destinationSection.style.display = tripExists ? 'none' : 'block';
    });
  }
});

// Handle adding an item to the itinerary
addItemBtn.addEventListener('click', () => {
  const item = itineraryInput.value.trim();
  if (item && currentTripId) {
    socket.emit('addItem', { tripId: currentTripId, item });
    itineraryInput.value = '';
  } else {
    alert('Please join a trip before adding items.');
  }
});

// Listen for updates to the itinerary from the server
socket.on('updateItinerary', (itinerary) => {
  itineraryList.innerHTML = '';
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

  document.querySelectorAll('.upvote-btn').forEach(button => {
    button.addEventListener('click', (event) => {
      const itemName = event.target.getAttribute('data-item');
      socket.emit('voteItem', { tripId: currentTripId, itemName, vote: 'upvote' });
    });
  });

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
    socket.emit('sendMessage', { tripId: currentTripId, username: currentUsername, message });
    chatInput.value = '';
  } else {
    alert('Please join a trip before sending messages.');
  }
});

// Listen for chat messages from the server
socket.on('receiveMessage', (data) => {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
});

// Listen for marker updates from the server
socket.on('updateMarkers', (markerData) => {
  markers.forEach(marker => marker.setMap(null)); // Clear existing markers
  markers = [];

  markerData.forEach(data => {
    const marker = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map
    });
    markers.push(marker);
  });
});
