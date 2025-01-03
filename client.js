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

const countrySelect = document.getElementById('country');
const stateSelect = document.getElementById('state');

// Chat elements
const messagesList = document.getElementById('messages');
const chatInput = document.getElementById('chat-input');
const sendChatBtn = document.getElementById('send-chat-btn');

// Authentication elements
const signupBtn = document.getElementById('signup-btn');
const loginBtn = document.getElementById('login-btn');
const signupUsername = document.getElementById('signup-username');
const signupEmail = document.getElementById('signup-email');
const signupPassword = document.getElementById('signup-password');
const loginUsername = document.getElementById('login-username');
const loginPassword = document.getElementById('login-password');

let map;
let markers = [];
let currentTripId = null;
let currentUsername = null;

// List of countries and US states
const countries = ["USA"];
const statesUSA = ["Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"];

countries.forEach(country => {
  const option = document.createElement('option');
  option.value = country;
  option.text = country;
  countrySelect.add(option);
});

// Show state dropdown when 'USA' is selected
countrySelect.addEventListener('change', () => {
  const selectedCountry = countrySelect.value;
  if (selectedCountry === 'USA') {
    stateSelect.style.display = 'block'; 
    stateSelect.innerHTML = '<option value="">Select State</option>'; 

    statesUSA.forEach(state => {
      const option = document.createElement('option');
      option.value = state;
      option.text = state;
      stateSelect.add(option);
    });
  } else {
    stateSelect.style.display = 'none'; 
  }
});
// Add DirectionsService and DirectionsRenderer for routing
let directionsService;
let directionsRenderer;
// Initialize Google Map when called
function initMap() {
  map = new google.maps.Map(mapElement, {
    center: { lat: 0, lng: 0 },
    zoom: 2
  });

  // Initialize DirectionsService and DirectionsRenderer
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({
    map: map,
    suppressMarkers: true // Suppress default markers to use custom markers
  });
  // Initialize the search bar for location search
  const input = document.getElementById("map-search");
  const searchBox = new google.maps.places.SearchBox(input);

  // Bias the SearchBox results towards the map's current viewport.
  map.addListener("bounds_changed", () => {
    searchBox.setBounds(map.getBounds());
  });

  // Place a marker when the user selects a location from the search box
  searchBox.addListener("places_changed", () => {
    const places = searchBox.getPlaces();

    if (places.length === 0) {
      return;
    }

    // Clear out the old markers.
    markers.forEach(marker => marker.setMap(null));
    markers = [];

    // For each place, get the icon, name, and location.
    const bounds = new google.maps.LatLngBounds();
    places.forEach(place => {
      if (!place.geometry || !place.geometry.location) {
        console.log("Returned place contains no geometry");
        return;
      }

      // Create a marker for each place.
      const marker = new google.maps.Marker({
        map,
        title: place.name,
        position: place.geometry.location
      });
      markers.push(marker);

      // Add click listener to display place information
      marker.addListener('click', () => {
        const service = new google.maps.places.PlacesService(map);
        service.getDetails({ placeId: place.place_id }, (placeDetails, status) => {
          if (status === google.maps.places.PlacesServiceStatus.OK) {
            const contentString = `
              <div>
                <strong>${placeDetails.name}</strong><br>
                ${placeDetails.photos ? `<img src="${placeDetails.photos[0].getUrl()}" alt="${placeDetails.name}" style="width: 100px; height: auto;">` : ''}<br>
                ${placeDetails.formatted_address}<br>
                ${placeDetails.opening_hours ? 'Open now: ' + (placeDetails.opening_hours.isOpen() ? 'Yes' : 'No') : ''}<br>
                ${placeDetails.rating ? 'Rating: ' + placeDetails.rating : ''}<br>
                <button id="pin-location">Pin Location</button>
              </div>
            `;

            const infoWindow = new google.maps.InfoWindow({
              content: contentString
            });
            infoWindow.open(map, marker);

            // Add listener to "Pin Location" button inside the info window
            google.maps.event.addListenerOnce(infoWindow, 'domready', () => {
              document.getElementById("pin-location").addEventListener("click", () => {
                socket.emit('addMarker', {
                  tripId: currentTripId,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                  description: `${placeDetails.name}, ${placeDetails.formatted_address}`
                });
                infoWindow.close();
                alert("Location pinned successfully!");
              });
            });
          }
        });
      });

      if (place.geometry.viewport) {
        bounds.union(place.geometry.viewport);
      } else {
        bounds.extend(place.geometry.location);
      }
    });
    map.fitBounds(bounds);
  });
}
// Add function to update route connecting markers
function updateRoute() {
  if (markers.length < 2) return; // No route if fewer than 2 markers

  const waypoints = markers.slice(1, markers.length - 1).map(marker => ({
    location: marker.position,
    stopover: true
  }));

  const request = {
    origin: markers[0].position,
    destination: markers[markers.length - 1].position,
    waypoints: waypoints,
    travelMode: 'DRIVING' // Change to 'WALKING', 'BICYCLING', etc. if needed
  };

  directionsService.route(request, (result, status) => {
    if (status === 'OK') {
      directionsRenderer.setDirections(result);

      // Extract and display total distance and duration
      const route = result.routes[0];
      let totalDistance = 0;
      let totalDuration = 0;

      route.legs.forEach(leg => {
        totalDistance += leg.distance.value;
        totalDuration += leg.duration.value;
      });

      alert(`Total Distance: ${(totalDistance / 1000).toFixed(2)} km, Total Duration: ${(totalDuration / 60).toFixed(2)} minutes`);
    } else {
      console.error('Directions request failed due to ' + status);
    }
  });
}

// Update socket listener for marker updates to call updateRoute
socket.on('updateMarkers', (markerData) => {
  markers.forEach(marker => marker.setMap(null));
  markers = [];

  markerData.forEach(data => {
    const marker = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map
    });
    markers.push(marker);

    // Display info window with description on marker click
    const infoWindow = new google.maps.InfoWindow({
      content: data.description,
    });
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });
  });

  updateRoute(); // Update the route whenever markers are updated
});
// Signup
signupBtn.addEventListener('click', () => {
  const username = signupUsername.value;
  const email = signupEmail.value;
  const password = signupPassword.value;

  fetch('/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password })
  }).then(response => {
    if (response.ok) {
      currentUsername = username; // Set currentUsername after signup
      document.getElementById('auth-section').style.display = 'none';
      tripSection.style.display = 'block';
    }
    return response.text();
  }).then(message => {
    alert(message);
  }).catch(console.error);
});

// Login
loginBtn.addEventListener('click', () => {
  const username = loginUsername.value;
  const password = loginPassword.value;

  fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  }).then(response => {
    if (response.ok) {
      currentUsername = username; // Set currentUsername after login
      document.getElementById('auth-section').style.display = 'none';
      tripSection.style.display = 'block';
    }
    return response.text();
  }).then(message => {
    alert(message);
  }).catch(console.error);
});


joinTripBtn.addEventListener('click', () => {
  const tripId = tripIdInput.value.trim();
  const selectedCountry = countrySelect.value;
  const selectedState = stateSelect.value;

  if (tripId) {
    socket.emit('checkTrip', { tripId }, (tripExists) => {
      if (tripExists) {
        currentTripId = tripId;
        socket.emit('joinTrip', { tripId, username: currentUsername });
        displayMainContent(); 
      } else {
        if (selectedCountry) {
          if (selectedCountry === 'USA' && !selectedState) {
            alert('Please select a state for the USA.');
            return;
          }
          currentTripId = tripId;
          socket.emit('joinTrip', {
            tripId,
            username: currentUsername,
            destinationCity: selectedState || 'N/A',
            destinationCountry: selectedCountry
          });
          displayMainContent();
          centerMapOnLocation(selectedCountry, selectedState);
        } else {
          alert('Please select a country.');
        }
      }
    });
  } else {
    alert('Please enter a Trip ID.');
  }
});


// Center the map based on the selected country/state and save to the server
function centerMapOnLocation(country, state) {
  const geocoder = new google.maps.Geocoder();
  let location = state ? `${state}, ${country}` : country;

  geocoder.geocode({ address: location }, (results, status) => {
    if (status === 'OK' && results[0]) {
      const newCenter = results[0].geometry.location;
      map.setCenter(newCenter);
      map.setZoom(state ? 6 : 4);

      socket.emit('saveMapCenter', {
        tripId: currentTripId,
        lat: newCenter.lat(),
        lng: newCenter.lng(),
        zoom: state ? 6 : 4
      });
    } else {
      console.error('Geocode was not successful for the following reason: ' + status);
    }
  });
}

// Show the main content, including the map
function displayMainContent() {
  tripSection.style.display = 'none';
  mainContent.style.display = 'flex';
  mapElement.style.display = 'block';

  if (!map) {
    initMap();
  } else {
    google.maps.event.trigger(map, 'resize');
  }
}

// Show or hide country/state fields when creating a new trip
tripIdInput.addEventListener('input', () => {
  const tripId = tripIdInput.value.trim();
  if (tripId) {
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
    itineraryInput.value = '';
  } else {
    alert('Please type before adding items.');
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

  // Add upvote and downvote functionality
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

// Listen for updated votes from the server
socket.on('updateVotes', (updatedItem) => {
  const itemElement = document.querySelector(`.upvote-btn[data-item="${updatedItem.name}"]`).parentElement;
  itemElement.innerHTML = `
    ${updatedItem.name} - Upvotes: ${updatedItem.upvotes}, Downvotes: ${updatedItem.downvotes}
    <button class="upvote-btn" data-item="${updatedItem.name}">Upvote</button>
    <button class="downvote-btn" data-item="${updatedItem.name}">Downvote</button>
  `;

  // Re-bind the upvote and downvote buttons
  itemElement.querySelector('.upvote-btn').addEventListener('click', (event) => {
    socket.emit('voteItem', { tripId: currentTripId, itemName: updatedItem.name, vote: 'upvote' });
  });
  itemElement.querySelector('.downvote-btn').addEventListener('click', (event) => {
    socket.emit('voteItem', { tripId: currentTripId, itemName: updatedItem.name, vote: 'downvote' });
  });
});

// Handle sending chat messages
sendChatBtn.addEventListener('click', () => {
  const message = chatInput.value.trim();
  if (message && currentTripId) {
    socket.emit('sendMessage', { tripId: currentTripId, username: currentUsername, message });
    chatInput.value = '';
  } else {
    alert('Please type before sending messages.');
  }
});


// Listen for chat messages from the server
socket.on('receiveMessage', (data) => {
  const li = document.createElement('li');
  li.innerHTML = `<strong>${data.username}:</strong> ${data.message}`;
  messagesList.appendChild(li);
  messagesList.scrollTop = messagesList.scrollHeight;
});


// Listen for marker updates and update pinned locations list
socket.on('updateMarkers', (markerData) => {
  markers.forEach(marker => marker.setMap(null)); // Clear existing markers
  markers = [];

  const pinnedLocationsList = document.getElementById('pinned-locations-list');
  pinnedLocationsList.innerHTML = ''; // Clear pinned locations list

  markerData.forEach(data => {
    const marker = new google.maps.Marker({
      position: { lat: data.lat, lng: data.lng },
      map: map
    });
    markers.push(marker);

    // Add location to pinned locations list
    const listItem = document.createElement('li');
    listItem.textContent = data.description;
    pinnedLocationsList.appendChild(listItem);

    // Display info window with description on marker click
    const infoWindow = new google.maps.InfoWindow({
      content: data.description,
    });
    marker.addListener('click', () => {
      infoWindow.open(map, marker);
    });
  });
});

const backToJoinBtn = document.getElementById('back-to-join-btn');

// Function to toggle the visibility of the "Back to Join Trip" button
function toggleBackButton(visible) {
  backToJoinBtn.style.display = visible ? 'block' : 'none';
}

// Function to show the main content (map and chat)
function showMainContent() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('trip-section').style.display = 'none';
  document.getElementById('main-content').style.display = 'flex';

  // Ensure the "Back to Join Trip" button is visible on the main page
  toggleBackButton(true);
}

// Function to show the Join Trip section
function showJoinTripPage() {
  document.getElementById('auth-section').style.display = 'none';
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('trip-section').style.display = 'block';

  // Hide the "Back to Join Trip" button while on the Join Trip page
  toggleBackButton(false);
}

// Function to show the Login/Signup section
function showLoginPage() {
  document.getElementById('main-content').style.display = 'none';
  document.getElementById('trip-section').style.display = 'none';
  document.getElementById('auth-section').style.display = 'block';

  // Hide the "Back to Join Trip" button while on the Login page
  toggleBackButton(false);
}

// Event listener for the "Back to Join Trip" button
backToJoinBtn.addEventListener('click', () => {
  showJoinTripPage();
});

// Handle transitions after login or signup
loginBtn.addEventListener('click', () => {
  // Simulate successful login and go to the Join Trip page
  showJoinTripPage();
});

signupBtn.addEventListener('click', () => {
  // Simulate successful signup and go to the Join Trip page
  showJoinTripPage();
});

// Handle joining a trip
joinTripBtn.addEventListener('click', () => {
  // Simulate joining a trip and transition to the main page
  const tripId = document.getElementById('trip-id').value.trim();
  if (tripId) {
    showMainContent();
  } else {
    alert('Please enter a Trip ID to join a trip.');
  }
});


// Listen for the event to center the map on the saved location
socket.on('centerMap', ({ lat, lng, zoom }) => {
  if (map) {
    map.setCenter({ lat, lng });
    map.setZoom(zoom);
  }
});
