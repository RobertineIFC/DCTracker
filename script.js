document.addEventListener('DOMContentLoaded', function () {
  var maxBounds = [
      [-90, -180],
      [90, 180]
  ];
  var mymap = L.map('map', {
      center: [10, -0],
      zoom: 2,
      noWrap: true,
      maxBounds: maxBounds,
      maxBoundsViscosity: 0.85
  });

  const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      noWrap: true
  }).addTo(mymap);

  const darkLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png');
  const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');
  const buttonImage = document.getElementById("changeMapBtn");
  buttonImage.querySelector('img').src = "static/sat.png";

  const geocoder = L.Control.geocoder({
      defaultMarkGeocode: false,
  }).addTo(mymap);

  let flightMarkers = [];
  let routePolyline;
  let segmentPolyline;

  async function onMarkerClick(e) {
      const flightId = e.target.flightId;

      removeExistingPolyline();
      removeFlightInfoInTextSection();

      const route = await fetchFlightRoute(flightId);

      showFlightInfoInTextSection(e.target.flightInfo);

      if (route) {
          displayRoutePolyline(route, e.latlng);
      }
  }

  async function removeExistingPolyline() {
      if (routePolyline) {
          mymap.removeLayer(routePolyline);
          routePolyline = null;
      }
      if (segmentPolyline) {
          mymap.removeLayer(segmentPolyline);
          segmentPolyline = null;
      }
  }

  function removeFlightInfoInTextSection() {
      const textSection = document.getElementById('text-section');
      textSection.innerHTML = '';
  }
  removeFlightInfoInTextSection()

  async function fetchFlightRoute(flightId) {
      const apiKey = '16g9z0yzub3dszefdibss5455tytdhkr';
      const sessionId = 'df2a8d19-3a54-4ce5-ae65-0b722186e44c';
      const routeApiUrl = `https://api.infiniteflight.com/public/v2/sessions/${sessionId}/flights/${flightId}/route?apikey=${apiKey}`;

      try {
          const response = await fetch(routeApiUrl);
          const data = await response.json();

          if (data.errorCode === 0) {
              return data.result;
          } else {
              console.error('Error fetching route:', data);
              return null;
          }
      } catch (error) {
          console.error('Error fetching route:', error);
          return null;
      }
  }

  function showFlightInfoInTextSection(flightInfo) {
      const { username, callsign, altitude, speed } = flightInfo;
      const roundedAltitude = Math.round(altitude);
      const roundedSpeed = Math.round(speed);

      const textSection = document.getElementById('text-section');
      const flightInfoContent = `
          <h2>Flight Information</h2>
          <p><b>Username:</b> ${username || 'No Username :('}</p>
          <p><b>Callsign:</b> ${callsign}</p>
          <p><b>Altitude:</b> ${roundedAltitude} feet</p>
          <p><b>Speed:</b> ${roundedSpeed} knots</p>
      `;

      textSection.innerHTML = flightInfoContent;
  }

  function displayRoutePolyline(route, clickedMarkerLatLng) {
    const coordinates = route.map(point => [point.latitude, point.longitude]);

    if (routePolyline) {
        mymap.removeLayer(routePolyline);
    }

    const lastPointIndex = coordinates.length - 1;
    const routeCoordinates = coordinates.slice(0, lastPointIndex);

    routePolyline = L.polyline(routeCoordinates, { color: 'blue' }).addTo(mymap);

    const lastPoint = [clickedMarkerLatLng.lat, clickedMarkerLatLng.lng];
    routePolyline.addLatLng(lastPoint);
  }


  function changeMapStyle() {
      if (mymap.hasLayer(osmLayer)) {
          buttonImage.querySelector('img').src = "static/dark.png";
          mymap.removeLayer(osmLayer);
          mymap.addLayer(satelliteLayer);
      } else if (mymap.hasLayer(satelliteLayer)) {
          mymap.removeLayer(satelliteLayer);
          mymap.addLayer(darkLayer);
          buttonImage.querySelector('img').src = "static/map.png";
      } else {
          mymap.removeLayer(darkLayer);
          mymap.addLayer(osmLayer);
          buttonImage.querySelector('img').src = "static/sat.png";
      }

      removeExistingPolyline();
      removeFlightInfoInTextSection();

      updateFlightMarkers();
  }

  function getMarkerIconUrl(flightInfo) {
    console.log("Flight Username:", flightInfo.username);
    const currentMapStyle = getCurrentMapStyle();
    const { username } = flightInfo;

    if (username === 'Robertine' || username === 'Stan7' || username === 'seanflynn') {
        console.log("Using redplane.png");
        return "static/redplane.png";
    } else if (currentMapStyle === 'osm') {
        console.log("Using plane.png");
        return "static/plane.png";
    } else if (currentMapStyle === 'satellite') {
        console.log("Using default orangeplane.png");
        return "static/orangeplane.png";
    } else {
        console.log("Using default orangeplane.png");
        return "static/orangeplane.png";
    }
  }


  function getCurrentMapStyle() {
      if (mymap.hasLayer(osmLayer)) {
          return 'osm';
      } else if (mymap.hasLayer(satelliteLayer)) {
          return 'satellite';
      } else if (mymap.hasLayer(darkLayer)) {
          return 'dark';
      }
      return 'osm';
  }

  function zoomToLocation(e) {
      const latlng = e.geocode.center;
      mymap.flyTo(latlng, 14, {
          animate: true,
          duration: 1,
      });

      removeExistingPolyline();
      removeFlightInfoInTextSection();
  }

  function createFlightMarker(flight) {
      const { latitude, longitude, track, username, callsign, altitude, speed } = flight;
      const iconUrl = getMarkerIconUrl(flight);

      const marker = L.marker([latitude, longitude], {
          icon: L.divIcon({
              className: 'custom-marker',
              iconSize: [30, 30],
              iconAnchor: [15, 15],
              html: `<img src="${iconUrl}" style="width: 100%; height: 100%; transform: rotate(${track}deg);">`
          }),
      }).on('click', onMarkerClick);

      marker.flightId = flight.flightId;
      marker.flightInfo = { username, callsign, altitude, speed, track };
      marker.addTo(mymap);
      flightMarkers.push(marker);
  }

  function addFlightMarkers(flights) {
      const openPopup = mymap._popup;

      flightMarkers.forEach(marker => marker.remove());
      flightMarkers = [];

      flights.forEach(flight => {
          createFlightMarker(flight);
      });

      if (openPopup) {
          openPopup.openOn(mymap);
      }
  }

  async function fetchFlights() {
      const apiKey = '16g9z0yzub3dszefdibss5455tytdhkr';
      const sessionId = 'df2a8d19-3a54-4ce5-ae65-0b722186e44c';
      const apiUrl = `https://api.infiniteflight.com/public/v2/sessions/${sessionId}/flights?apikey=${apiKey}`;

      try {
          const response = await fetch(apiUrl);
          const data = await response.json();
          const flights = data.result;
          addFlightMarkers(flights);
      } catch (error) {
          console.error('Error fetching flights:', error);
      }
  }

  function clearRouteOnMapClick() {
      removeExistingPolyline();
      removeFlightInfoInTextSection();
  }

  document.getElementById('changeMapBtn').addEventListener('click', changeMapStyle);
  setInterval(fetchFlights, 5000);

  geocoder.on('markgeocode', zoomToLocation);

  mymap.on('click', clearRouteOnMapClick);

  fetchFlights();
});
