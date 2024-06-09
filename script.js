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
        maxBoundsViscosity: 0.85,
        minZoom: 2
    });

    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        noWrap: true
    }).addTo(mymap);

    // OpenWeatherMap API key
    var apiKeyweather = '55915385cd68325e3e3b68dcd1fd80f7';

    // Function to create OpenWeatherMap layer
    function createLayer(layerType) {
        return L.tileLayer(`https://tile.openweathermap.org/map/${layerType}/{z}/{x}/{y}.png?appid=${apiKeyweather}`, {
            opacity: 1,
            maxZoom: 19,
        });
    }

    // Initialize with precipitation layer
    var currentLayer = createLayer('precipitation_new');
    currentLayer.addTo(mymap);

    // Handle layer selection change
    document.getElementById('layerSelect').addEventListener('change', function(e) {
        var selectedLayer = e.target.value;
        if (currentLayer) {
            mymap.removeLayer(currentLayer);
        }
        currentLayer = createLayer(selectedLayer);
        currentLayer.addTo(mymap);
    });

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
        const flightInfo = await fetchFlightInfo(flightId);
        if (flightInfo) {
            showFlightInfoInTextSection(flightInfo);
            const route = await fetchFlightRoute(flightId);
            if (route) {
                displayRoutePolyline(route, e.latlng);
            }
        }
        console.log("Flight ID clicked:", e.target.flightId);
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

    async function fetchFlightInfo(flightId) {
        const apiKey = '16g9z0yzub3dszefdibss5455tytdhkr';
        const sessionId = 'df2a8d19-3a54-4ce5-ae65-0b722186e44c';
        const flightApiUrl = `https://api.infiniteflight.com/public/v2/sessions/${sessionId}/flights/${flightId}?apikey=${apiKey}`;

        try {
            const response = await fetch(flightApiUrl);
            const data = await response.json();

            if (data.errorCode === 0) {
                return data.result;
            } else {
                console.error('Error fetching flight info:', data);
                return null;
            }
        } catch (error) {
            console.error('Error fetching flight info:', error);
            return null;
        }
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
                console.error('Error fetching flight route:', data);
                return null;
            }
        } catch (error) {
            console.error('Error fetching flight route:', error);
            return null;
        }
    }


    function showFlightInfoInTextSection(flightInfo) {
        const { username, callsign, altitude, speed, aircraftId } = flightInfo;
        const roundedAltitude = Math.round(altitude);
        const roundedSpeed = Math.round(speed);
        const aircraftType = aircraftTypes[aircraftId] || 'Unknown';
        
        const textSection = document.getElementById('text-section');
        
        let flightStatus = '';
        let flightStatusColor = '';
        if (speed < 40) {
            flightStatus = 'On Ground';
            flightStatusColor = 'red';
        } else {
            flightStatus = 'In Flight';
            flightStatusColor = 'hsl(120, 100%, 50%)';
        }
        
        const flightInfoContent = `
            <h2>Flight Information</h2>
            <p><b>Username:</b> ${username || 'No Username :('}</p>
            <p><b>Callsign:</b> ${callsign}</p>
            <p><b>Aircraft Type:</b> ${aircraftType}</p>
            <p><b>Altitude:</b> <span>${roundedAltitude} feet</span></p>
            <p><b>Speed:</b> ${roundedSpeed} knots</p>
            <p><b>Flight Status:</b> <span style="color: ${flightStatusColor};">${flightStatus}</span></p>
        `;
        
        textSection.innerHTML = flightInfoContent;

        const downloadGPXButton = document.createElement('button');
        downloadGPXButton.textContent = 'Download GPX';
        downloadGPXButton.classList.add('btnStyle');
        downloadGPXButton.addEventListener('click', () => {
            downloadGPX(flightInfo);
        });
        textSection.appendChild(downloadGPXButton);


        const downloadKMLButton = document.createElement('button');
        downloadKMLButton.textContent = 'Download KML';
        downloadKMLButton.classList.add('btnStyle');
        downloadKMLButton.addEventListener('click', () => {
            downloadKML(flightInfo);
        });
        textSection.appendChild(downloadKMLButton);
    }

    async function downloadGPX(flightInfo) {
        const flightId = flightInfo.flightId;
        const route = await fetchFlightRoute(flightId);
        if (route) {
            const gpxData = generateGPX(route);
            const blob = new Blob([gpxData], { type: 'application/gpx+xml' });
            const link = document.createElement('a');
            const shortenedLastReport = flightInfo.lastReport.slice(0, 10);
            link.href = window.URL.createObjectURL(blob);
            link.download = flightInfo.username + '_' + shortenedLastReport + '.gpx';
            link.click();
        } else {
            console.error('Error downloading GPX: Route data is missing.');
        }
    }
    
    function generateGPX(route, username, date) {
        let gpxContent = `<?xml version="1.0" encoding="UTF-8"?>
    <gpx version="1.1" creator="Your Application Name" xmlns="http://www.topografix.com/GPX/1/1" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
      <metadata>
        <name>${username} - ${date}</name>
        <desc>Flight Route GPX</desc>
      </metadata>
      <trk>
        <name>${username} - ${date}</name>
        <desc>Flight Route GPX</desc>
        <trkseg>
    `;
        route.forEach(point => {
            gpxContent += `      <trkpt lat="${point.latitude}" lon="${point.longitude}">
            <ele>${point.altitude}/3.2808</ele>
            <time>${point.date}</time>
          </trkpt>
    `;
        });
        gpxContent += `    </trkseg>
      </trk>
    </gpx>`;
        return gpxContent;
    }


    async function downloadKML(flightInfo) {
        const flightId = flightInfo.flightId;
        const route = await fetchFlightRoute(flightId);
        if (route) {
            const currentDate = new Date().toISOString();
            const kmlData = generateKML(route, flightInfo.username, currentDate);
            const blob = new Blob([kmlData], { type: 'application/vnd.google-earth.kml+xml' });
            const link = document.createElement('a');
            const shortenedLastReport = flightInfo.lastReport.slice(0, 10);
            link.href = window.URL.createObjectURL(blob);
            link.download = flightInfo.username + '_' + shortenedLastReport + '.kml';
            link.click();
        } else {
            console.error('Error downloading KML: Route data is missing.');
        }
    }
    
    

    function generateKML(route, username, date) {
        let kmlContent = `<?xml version="1.0" encoding="UTF-8"?>
        <kml xmlns="http://www.opengis.net/kml/2.2">
          <Document>
            <name>${username} - ${date}</name>
            <description>Flight Route KML</description>
            <Style id="line-ffa500-240-nodesc-normal">
              <LineStyle>
                <color>ff00a5ff</color>
                <width>2</width>
              </LineStyle>
            </Style>
            <Placemark>
              <styleUrl>#line-ffa500-240-nodesc-normal</styleUrl>
              <LineString>
                <extrude>1</extrude>
                <tessellate>1</tessellate>
                <altitudeMode>absolute</altitudeMode>
                <coordinates>
        `;
        route.forEach(point => {
            kmlContent += `          ${point.longitude},${point.latitude},${point.altitude}/3.2808\n`;
        });
        kmlContent += `        </coordinates>
              </LineString>
            </Placemark>
          </Document>
        </kml>`;
        return kmlContent;
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
        const planeType = flightInfo.aircraftId;
    
        if (planeType === '206884f9-38a8-4118-a920-a7dcbd166c47') {
            console.log("Using C172.png for specific aircraft ID");
            return "static/C172.png";
        } else if (planeType === 'f11ed126-bce8-46ef-9265-69191c354575') {
            console.log("Using A380.png for specific aircraft ID");
            return "static/A380.png";
        } else if (planeType === 'ef677903-f8d3-414f-a190-233b2b855d46') {
            console.log("Using C172.png for specific aircraft ID");
            return "static/C172.png";
        } else if (planeType === '9769c825-0f89-4faf-abb1-9dd473321ede') {
            console.log("Using P38.png for specific aircraft ID");
            return "static/P38.png";
        } else if (planeType === 'c82da702-ea61-4399-921c-34f35f3ca5c4' || planeType === 'de510d3d-04f8-46e0-8d65-55b888f33129' || planeType === '9759c19f-8f18-40f5-80d1-03a272f98a3b') {
            console.log("Using 747.png for specific aircraft ID");
            return "static/747.png";
        } else if (planeType === '0a3edb21-d515-4619-8392-aef51b952ac9') {
            console.log("Using F18.png for specific aircraft ID");
            return "static/F18.png";
        } else if (planeType === '7bd8096f-8eae-47b9-8e1a-38dabd2c59c4') {
            console.log("Using F16.png for specific aircraft ID");
            return "static/F16.png";
        } else if (planeType === 'bec63a00-a483-4427-a076-0f76dba0ee97' || '8290107b-d728-4fc3-b36e-0224c1780bac' || 'e258f6d4-4503-4dde-b25c-1fb9067061e2' || '6925c030-a868-49cc-adc8-7025537c51ca') {
            console.log("Using 777.png for specific aircraft ID");
            return "static/777.png";
        } else if (planeType === '982dd974-5be7-4369-90c6-bd92863632ba' || '2c2f162e-a7d9-4ebd-baf4-859aed36165a' || 'a266b67f-03e3-4f8c-a2bb-b57cfd4b12f3' || 'd7434d84-555a-4d9b-93a7-53c77cf846ea') {
            console.log("Using A320.png for specific aircraft ID");
            return "static/A320.png";
        } else if (planeType === '8a62f1d0-bca9-494c-bc01-1fb8b7255f76') {
            console.log("Using Spitfire.png for specific aircraft ID");
            return "static/Spitfire.png";
        } else {
            console.log("Using plane.png");
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
        removeFlightInfoInTextSection();
    }

    function createFlightMarker(flight) {
        const { latitude, longitude, track, username, callsign, altitude, speed } = flight;
        let iconSize = [40, 40]; 
        const iconUrl = getMarkerIconUrl(flight);
    
        if (flight.aircraftId === 'ef677903-f8d3-414f-a190-233b2b855d46') {
            iconSize = [28, 26];
        }
        else if (flight.aircraftId === 'e258f6d4-4503-4dde-b25c-1fb9067061e2') {
            iconSize = [33, 40];
        }
        else if (flight.aircraftId === '0a3edb21-d515-4619-8392-aef51b952ac9' || '7bd8096f-8eae-47b9-8e1a-38dabd2c59c4') {
            iconSize = [30, 34];
        }
    
        const marker = L.marker([latitude, longitude], {
            icon: L.divIcon({
                className: 'custom-marker',
                iconSize: iconSize,
                iconAnchor: [15, 15],
                html: `<img src="${iconUrl}" style="width: 100%; height: 100%; transform: rotate(${track}deg);">`
            }),
        }).on('click', onMarkerClick);
    
        marker.flightId = flight.flightId;
        marker.flightInfo = { username, callsign, altitude, speed, track, aircraftId: flight.aircraftId };
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
