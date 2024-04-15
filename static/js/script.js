const APIKEY = `74e74212810120ff011cae4328da36a6`;
let map;
let clickedMarkers = [];
let airportArray = [];

const getWeatherInfo = async (lat, lng) => {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${APIKEY}`)

        const data = await response.json();
        console.log(data)

        return {
            temperature: data.main.temp,
            description: data.weather[0].description,
        };

    } catch (error) {
        console.error(error)
    }
}

const initializeMap = () => {
    map = L.map('map').setView([0, 0], 3); // Change 3 to your desired initial zoom level
    L.tileLayer(`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, {
        maxZoom: 13,
        attribution: `&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>`
    }).addTo(map);
};

const buildAirports = () => {
    fetch('static/public/mAirports.json')
        .then(response => response.json())
        .then(airports => {
            airports.forEach(airport => {
                const [lat, lng] = convertDMSToDecimal(airport["Geographic Location"]);
                const marker = L.marker([lat, lng]).addTo(map);

                marker.on('popupopen', (event) => {
                    const targetMarker = event.target;

                    // Check if weather data is already loaded
                    if (!targetMarker.weatherInfo) {
                        targetMarker.setPopupContent("Loading weather data...");
                        getWeatherInfo(lat, lng).then(weatherInfo => {
                            targetMarker.weatherInfo = weatherInfo; // Cache weather data in the marker
                            const popupContent = createPopupContent(airport, weatherInfo);
                            targetMarker.setPopupContent(popupContent);
                        }).catch(error => {
                            targetMarker.setPopupContent("Failed to load weather data");
                        });
                    }

                    handleMarkerClick(targetMarker);

                    if (airportArray.length < 2) {
                        console.log(`Airport Added: ${airport["elevationInFt"]}`)
                        airportArray.push(airport["elevationInFt"]);
                    } else {
                        airportArray = [];
                        airportArray.push(airport["elevationInFt"]);
                    }

                    // Filter airplanes based on elevation of the first airport
                    if (airportArray.length === 2) {
                        console.log(`Getting Max Elevation: ${Math.max(...airportArray)}`)
                        fetchAndFilterAirplanes(Math.max(...airportArray));
                    }
                });

                marker.bindPopup("Click to load weather data");
            });
        });
};

class Airplane {
    constructor(speed_kph, type_of_plane, seats_remaining, price_per_km, extraFuelCharge, maxTakeOffAlt) {
        this.type_of_plane = type_of_plane;
        this.speed_kph = speed_kph;
        this.maxTakeOffAlt = maxTakeOffAlt;
        this.seats_remaining = seats_remaining;
        this.price_per_km = price_per_km;
        this.extraFuelCharge = extraFuelCharge;
    }
}

class Airports {
    constructor(city, airportName, country, elevation, lat, lon) {
        this.airportName = airportName;
        this.city = city;
        this.country = country;
        this.elevation = elevation;
        this.lat = lat;
        this.lon = lon;
    }
}

const handleMarkerClick = (marker) => {
    clickedMarkers.push(marker);

    // if polyline already exists, remove it
    map.eachLayer((layer) => {
        if (layer instanceof L.Polyline) {
            map.removeLayer(layer);
        }
    });

    // Check if we have two markers to draw a line between
    if (clickedMarkers.length === 2) {
        const [marker1, marker2] = clickedMarkers;
        const latLng1 = marker1.getLatLng();
        const latLng2 = marker2.getLatLng();

        // Create the polyline
        const polyline = L.polyline([latLng1, latLng2], { color: 'red' }).addTo(map);

        // Calculate the distance
        const distance = latLng1.distanceTo(latLng2);
        const distanceInKm = distance / 1000;

        clickedMarkers = []; // Reset the array after drawing the line

        // Use jQuery to show the off-canvas
        $('#offcanvasScrolling').offcanvas('show');
        $('#offcanvasRightScrolling').offcanvas('show');

        // Update the content of the off-canvas, if necessary
        updateOffCanvasContentLeft(latLng1, latLng2);

    } else if (clickedMarkers.length > 2) {
        // Reset if more than 2 markers are clicked without clearing the first two
        clickedMarkers = [marker];
    }


};

const createPopupContent = (airport, weatherInfo, lat, lng) => `
    <h3>${airport["City Name"]}</h3>
    <p><strong>Airport Name:</strong> ${airport["Airport Name"]}</p>
    <p><strong>Country:</strong> ${airport["Country"]}</p>
    <p><strong>Elevation:</strong> ${airport["elevationInFt"]} ft</p>
    <p><strong>Latitude:</strong> ${airport["Geographic Location"].substring(0, 5)}</p>
    <p><strong>Longitude:</strong> ${airport["Geographic Location"].substring(5)}</p>
    <p><strong>Temperature:</strong> ${weatherInfo.temperature}°C</p>
    <p><strong>Weather Description:</strong> ${weatherInfo.description}</p>
`;

const convertDMSToDecimal = (coordinate) => {
    const [lat, lon] = coordinate.split(' ');

    const convertPart = (part) => {
        const direction = part.slice(-1);
        const degrees = parseInt(part.slice(0, -3), 10);
        const minutes = parseInt(part.slice(-3, -1), 10) / 60;
        return (direction === 'S' || direction === 'W') ? -(degrees + minutes) : degrees + minutes;
    };

    return [convertPart(lat), convertPart(lon)];
};

const updateOffCanvasContentLeft = (latLng1, latLng2) => {
    const offCanvasBody = $('#offcanvasScrolling .offcanvas-body');
    offCanvasBody.html(`
        <div class="card" style="width: 18rem;">
          <img src="https://placehold.co/400" class="card-img-top" alt="PLACEHOLDER">
          <div class="card-body">
            <h5 class="card-title">Card title</h5>
            <p class="card-text">Some quick example text to build on the card title and make up the bulk of the card's content.</p>
          </div>
        </div>
    `);
}

const updateOffCanvasContentRight = (airplanes) => {
    const offCanvasBody = $('#offcanvasRightScrolling .offcanvas-body');
    let content = airplanes.map(plane => `
        <div class="card mb-3" style="width: 18rem;">
          <img src="https://placehold.co/400" class="card-img-top" alt="PLCEHOLDER">
          <div class="card-body">
            <h5 class="card-title">cHOOSE yOUR pLANE</h5>
            <p class="card-text">
                <strong>Type:</strong> ${plane.type_of_plane}<br>
                <strong>Speed:</strong> ${plane.speed_kph} km/h<br>
                <strong>Max Takeoff Altitude:</strong> ${plane.maxTakeOffAlt} ft<br>
                <strong>Seats Remaining:</strong> ${plane.seats_remaining}<br>
                <strong>Price per km:</strong> ${plane.price_per_km}<br>
                <strong>Extra Fuel Charge:</strong> ${plane.extraFuelCharge}
            </p>
            <a href="#" class="btn btn-primary">Go somewhere</a>
          </div>
        </div>
    `).join('');
    offCanvasBody.html(content);
}

const fetchAndFilterAirplanes = async (elevation) => {
    try {
        const response = await fetch('static/public/fake_flights.json'); // Adjust the path as necessary
        const airplanesData = await response.json();

        // First filter the raw data
        const suitableAirplaneData = airplanesData.filter(airplane => airplane.maxTakeOffAlt >= elevation);

        const airplanes = suitableAirplaneData.map(airplane => new Airplane(
            airplane.type_of_plane,
            airplane.speed_kph,
            airplane.maxTakeOffAlt,
            airplane.seats_remaining,
            airplane.price_per_km,
            airplane.extraFuelCharge
        ));

        console.log(airplanes);
        updateOffCanvasContentRight(airplanes);
    } catch (error) {
        console.error('Failed to load airplane data:', error);
    }
};

const mapContainer = $('#map'); // Your map container
const offCanvasWidth = $('.offcanvasScrolling').width(); // Get the width of the off-canvas

$('#offcanvasScrolling').on('show.bs.offcanvas', function () {
    mapContainer.css('margin-left', offCanvasWidth + 'px'); // Adjust the left margin
    map.invalidateSize(); // Invalidate size for Leaflet map to adjust
});

$('#offcanvasScrolling').on('hidden.bs.offcanvas', function () {
    mapContainer.css('margin-left', '0'); // Reset the left margin
    map.invalidateSize(); // Invalidate size for Leaflet map to adjust
});

initializeMap();
buildAirports();
