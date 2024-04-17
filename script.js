/* Coucou les gars :) J'ai commenté les trucs qui peuvent ne pas avoir l'air clairs mais si vous avez des questions sur ce que j'ai fait, n'hesitez pas.
OSM c'est une abbreviation, c'est OpenStreetMap, le provider de la carte.
Meme si c'est plus joli, n'enlevez pas le "© OpenStreetMap contributors", sinon c'est illegal :) Faut garder le acknowledgement

Les seuls problèmes auquels je peux penser pour l'instant c'est que les icones bleus sont durs a voir sur le fond satellite et les FPL ne sont pas visibles quand on click. 
Evidemment Alex peut changer le CSS, c'est lui, monsieur Front-end, pas moi hihi
Je n'ai pas mis la fonction pour filtrer les VA/Callsign car ca sera mieux en Django, en JS c'est lent a mourir
Dernière note; Les photos pour le bouton map toggle sont des screenshots que j'ai pris. Je n'ai pas trouvé mieux mais si vous arrivez a faire des previews ca serait cool!!

Bonne journée/soirée!!!  */



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

  async function onMarkerClick(e) {
    const flightId = e.target.flightId;
    removeExistingPolyline();
    removeFlightInfoPopup();
    const route = await fetchFlightRoute(flightId);
    showFlightInfoPopup(e.latlng, e.target.flightInfo);
    if (route) {
      displayRoutePolyline(route);
    }
  }

  function removeExistingPolyline() {
    if (routePolyline) {
      mymap.removeLayer(routePolyline);
      routePolyline = null;
    }
  }

  function removeFlightInfoPopup() {
    mymap.closePopup();
  }

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

  function showFlightInfoPopup(latlng, flightInfo) {
    const { username, callsign, altitude, speed } = flightInfo;
    const roundedAltitude = Math.round(altitude);
    const roundedSpeed = Math.round(speed);
    const popupContent = `
      <b>Username:</b> ${username || 'No Username :('}<br>
      <b>Callsign:</b> ${callsign}<br>
      <b>Altitude:</b> ${roundedAltitude} feet<br>
      <b>Speed:</b> ${roundedSpeed} knots
    `;
    L.popup()
      .setLatLng(latlng)
      .setContent(popupContent)
      .openOn(mymap);
  }

  function displayRoutePolyline(route) {
    const coordinates = route.map(point => [point.latitude, point.longitude]);
    routePolyline = L.polyline(coordinates, { color: 'blue' }).addTo(mymap);
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
    removeFlightInfoPopup();
    updateFlightMarkers();
  }

  function updateFlightMarkers() {
    flightMarkers.forEach(marker => {
      const iconUrl = getMarkerIconUrl(marker.flightInfo);
      marker.setIcon(L.divIcon({
        className: 'custom-marker',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        html: `<img src="${iconUrl}" style="width: 100%; height: 100%; transform: rotate(${marker.flightInfo.track}deg);">`
      }));
    });
  }

  function getMarkerIconUrl(flightInfo) {
    const currentMapStyle = getCurrentMapStyle();
    if (currentMapStyle === 'satellite') {
      return "static/orangeplane.png";
    } else {
      return "static/plane.png";
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
    removeFlightInfoPopup();
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
    flightMarkers.forEach(marker => marker.remove());
    flightMarkers = [];
    removeExistingPolyline();
    removeFlightInfoPopup();
    flights.forEach(flight => {
      createFlightMarker(flight);
    });
  }

  async function fetchFlightsAndRefreshMap() {
    try {
      const apiKey = '16g9z0yzub3dszefdibss5455tytdhkr';
      const sessionId = 'df2a8d19-3a54-4ce5-ae65-0b722186e44c';
      const apiUrl = `https://api.infiniteflight.com/public/v2/sessions/${sessionId}/flights?apikey=${apiKey}`;
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
    removeFlightInfoPopup();
  }

  document.getElementById('changeMapBtn').addEventListener('click', changeMapStyle);

  geocoder.on('markgeocode', zoomToLocation);

  mymap.on('click', clearRouteOnMapClick);

  // Initial call to fetch flights and refresh map
  fetchFlightsAndRefreshMap();

  // Refresh flights and map every 3 seconds
  setInterval(fetchFlightsAndRefreshMap, 3000);
});


