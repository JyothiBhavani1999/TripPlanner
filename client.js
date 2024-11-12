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

// Initialize Google Map when called
function initMap() {
  map = new google.maps.Map(mapElement, {
    center: { lat: 0, lng: 0 },
    zoom: 2
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

  // Add marker on map click with description
  map.addListener('click', (e) => {
    const latLng = e.latLng;
    const description = prompt("Enter information about this location:");

    if (description) {
      const marker = new google.maps.Marker({
        position: latLng,
        map: map
      });
      markers.push(marker);

      // Emit marker data to server with description
      if (currentTripId) {
        socket.emit('addMarker', { tripId: currentTripId, lat: latLng.lat(), lng: latLng.lng(), description });
      }

      // Add click listener to show info window with description
      const infoWindow = new google.maps.InfoWindow({
        content: description,
      });
      marker.addListener('click', () => {
        infoWindow.open(map, marker);
      });
    }
  });
}

// Handle joining or creating a trip
joinTripBtn.addEventListener('click', () => {
  const tripId = tripIdInput.value.trim();
  currentUsername = usernameInput.value.trim() || 'Anonymous';
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
});

// Listen for the event to center the map on the saved location
socket.on('centerMap', ({ lat, lng, zoom }) => {
  if (map) {
    map.setCenter({ lat, lng });
    map.setZoom(zoom);
  }
});
