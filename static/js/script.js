const APIKEY = `74e74212810120ff011cae4328da36a6`;
let map;
let clickedMarkers = [];

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

                    // Handle the clicked markers for drawing a line
                    handleMarkerClick(targetMarker);
                });

                marker.bindPopup("Click to load weather data");
            });
        });
};

const handleMarkerClick = (marker) => {
    console.log(`Marker clicked at ${marker.getLatLng()}`);
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
        console.log(`Distance in METERS: ${distance}`); // Distance in meters
        console.log(`Distance in KILOMETERS: ${distanceInKm}`); // Distance in kilometers

        clickedMarkers = []; // Reset the array after drawing the line

        // Use jQuery to show the off-canvas
        $('#offcanvasScrolling').offcanvas('show');

        // Update the content of the off-canvas, if necessary
        updateOffCanvasContent(latLng1, latLng2);

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

const updateOffCanvasContent = (latLng1, latLng2) => {
    const offCanvasBody = $('#offcanvasScrolling .offcanvas-body');
    offCanvasBody.html(`
        <div>First location: ${latLng1.lat}, ${latLng1.lng}</div>
        <div>Second location: ${latLng2.lat}, ${latLng2.lng}</div>
    `);
}


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

