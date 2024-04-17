const APIKEY = `74e74212810120ff011cae4328da36a6`;
const ThundeRforestAPIKEY = `edc755a6b68a469a8bccd7262db90687`
let map;
let clickedMarkers = [];
let airportElevationArray = [];
let airportsArray = [];
let distance;
let isItRaining = false;
let lengthOfFlight;
let totalCost;
let isDistanceCalculated = false;

window.onload = function() {
    // Retrieve data from localStorage
    const selectedPlane = JSON.parse(localStorage.getItem('selectedPlane'));
    const selectedAirports = JSON.parse(localStorage.getItem('selectedAirports'));
    distance = parseFloat(localStorage.getItem('distance'));
    totalCost = parseFloat(localStorage.getItem('totalCost'));
    lengthOfFlight = parseFloat(localStorage.getItem('lengthOfFlight'));

    // Check if the data exists
    if (selectedPlane && selectedAirports) {
        // Update the display
        updateOffCanvasContentLeft(selectedAirports);
        addAirplaneToCart(selectedPlane);
        // Open the left offcanvas
        $('#offcanvasScrolling').offcanvas('show');
    }
};


const getWeatherInfo = async (lat, lng) => {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${APIKEY}`)

        const data = await response.json();
        // console.log(data)

        return {
            temperature: data.main.temp,
            description: data.weather[0].description,
        };

    } catch (error) {
        console.error(error)
    }
}

const initializeMap = () => {

    let southWest = L.latLng(-89.98155760646617, -180),
        northEast = L.latLng(89.99346179538875, 180);
    let bounds = L.latLngBounds(southWest, northEast);

    map = L.map('map', {
        center: [0, 0],
        zoom: 4,
        minZoom: 4,
        maxzoom: 13,
        maxBounds: bounds,
        maxBoundsViscosity: 0.75
    });

    let osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        noWrap: true,
        zoomDelta: 0.25,
        zoomSnap: 0
    }).addTo(map);

    let thunderforestLayer = L.tileLayer(`https://{s}.tile.thunderforest.com/spinal-map/{z}/{x}/{y}.png?apikey=${ThundeRforestAPIKEY}`, {
        attribution: '&copy; <a href="http://www.thunderforest.com/">Thunderforest</a>, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    });

    let Stadia_AlidadeSmoothDark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.{ext}', {
        attribution: '&copy; <a href="https://www.stadiamaps.com/" target="_blank">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/" target="_blank">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        ext: 'png'
    });

    thunderforestLayer.addTo(map);

    L.control.layers({
        "OpenStreetMap": osmLayer,
        "Thunderforest SpinalMap": thunderforestLayer,
        "Stadia Alidade Smooth Dark": Stadia_AlidadeSmoothDark
    }).addTo(map);

    setTimeout(buildAirports, 250);
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

                            // Check if it's raining (rain, thunderstorm)
                            isItRaining = weatherInfo.description.includes('rain') || weatherInfo.description.includes('thunderstorm') || weatherInfo.description.includes('mist');
                        }).catch(error => {
                            targetMarker.setPopupContent("Failed to load weather data");
                        });
                    }

                    handleMarkerClick(targetMarker);

                    if (airportElevationArray.length < 2) {
                        airportElevationArray.push(airport["elevationInFt"]);
                        // add airport to array
                        airportsArray.push(new Airports(airport["City Name"], airport["Airport Name"], airport["Country"], airport["elevationInFt"], lat, lng));
                    } else {
                        airportElevationArray = [];
                        airportsArray = [];
                        airportsArray.push(new Airports(airport["City Name"], airport["Airport Name"], airport["Country"], airport["elevationInFt"], lat, lng));
                        airportElevationArray.push(airport["elevationInFt"]);
                    }

                    // Filter airplanes based on elevation of the first airport
                    if (airportElevationArray.length === 2) {
                        // console.log(`Getting Max Elevation: ${Math.max(...airportElevationArray)}`)
                        fetchAndFilterAirplanes(Math.max(...airportElevationArray));
                        updateOffCanvasContentLeft(airportsArray);
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
        let realDistance = latLng1.distanceTo(latLng2);
        distance = realDistance / 1000;
        isDistanceCalculated = true;

        clickedMarkers = []; // Reset the array after drawing the line

        // Use jQuery to show the off-canvas
        $('#offcanvasScrolling').offcanvas('show');
        $('#offcanvasRightScrolling').offcanvas('show');

        // Update the content of the off-canvas, if necessary
        updateOffCanvasContentLeft(latLng1, latLng2, marker);

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
    ${isDistanceCalculated ? `<p><strong>Total Distance:</strong> ${distance.toFixed(2)}</p>` : ''}
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

const updateOffCanvasContentLeft = (airportsArray) => {

    if (airportsArray.length > 0) {
        let latLng = airportsArray[0];

        console.log(`Airport 1: ${latLng.lat}, ${latLng.lon}`);

        const offCanvasBody = $('#airports');
        offCanvasBody.html(`
            <div class="card mb-3" style="width: 18rem;">
                <div class="card-body">
                    <h5 class="card-title">${airportsArray[0].city}</h5>
                    <p class="card-text">
                        <strong>Airport Name:</strong> ${airportsArray[0].airportName}<br>
                        <strong>Country:</strong> ${airportsArray[0].country}<br>
                        <strong>Elevation:</strong> ${airportsArray[0].elevation} ft<br>
                        <strong>Latitude:</strong> ${airportsArray[0].lat.toFixed(3)}<br>
                        <strong>Longitude:</strong> ${airportsArray[0].lon.toFixed(3)}
                    </p>
                </div>
            </div>
            <div class="card mb-3" style="width: 18rem;">
                <div class="card-body">
                    <h5 class="card-title">${airportsArray[1].city}</h5>
                    <p class="card-text">
                        <strong>Airport Name:</strong> ${airportsArray[1].airportName}<br>
                        <strong>Country:</strong> ${airportsArray[1].country}<br>
                        <strong>Elevation:</strong> ${airportsArray[1].elevation} ft<br>
                        <strong>Latitude:</strong> ${airportsArray[1].lat.toFixed(3)}<br>
                        <strong>Longitude:</strong> ${airportsArray[1].lon.toFixed(3)}
                    </p>
                </div>
            </div>
            <div class="card mb-3" style="width: 18rem;">
                <button type="button" class="btn btn-primary" id="selectAirportsAgain">Select Different</button>
            </div>
        `);

        // Attach event listeners
        attachButtonListenersLeftCanvas();

        localStorage.setItem('selectedAirports', JSON.stringify(airportsArray));
        localStorage.setItem('distance', distance);
    }
};

const calculateLengthOfFlight = (speed) => {
    return distance / speed; // Time in hours

}

const updateOffCanvasContentRight = (airplanes) => {
    const offCanvasBody = $('#offcanvasRightScrolling .offcanvas-body');
    let content = airplanes.map(((plane, index) => `
        <div class="card mb-3" style="width: 18rem;">
          <img src="https://placehold.co/400" class="card-img-top" alt="PLCEHOLDER">
          <div class="card-body">
            <p class="card-text">
                <strong>Type:</strong> ${plane.type_of_plane}<br>
                <strong>Speed:</strong> ${plane.speed_kph} km/h<br>
                <strong>Max Takeoff Altitude:</strong> ${plane.maxTakeOffAlt} ft<br>
                <strong>Seats Remaining:</strong> ${plane.seats_remaining}<br>
                <strong>Price per km:</strong> ${plane.price_per_km}<br>
                <strong>Extra Fuel Charge:</strong> ${plane.extraFuelCharge}
            </p>
            <a href="#" class="btn btn-primary plane-select-button" data-plane-index="${index}">Go somewhere</a>
          </div>
        </div>
    `)).join('');
    offCanvasBody.html(content);

    // Attach event listeners
    attachButtonListenersRightCanvas(airplanes);
}

const attachButtonListenersRightCanvas = (airplanes) => {
    const buttons = $('.plane-select-button');
    buttons.on('click', function (event) {
        event.preventDefault();
        const index = $(this).data('plane-index');
        const selectedPlane = airplanes[index];
        // console.log('Selected plane:', selectedPlane);

        addAirplaneToCart(selectedPlane);

        // close the right offcanvas
        $('#offcanvasRightScrolling').offcanvas('hide');
    });
}

const attachButtonListenersLeftCanvas = () => {
    const button = $('#selectAirportsAgain');
    button.on('click', function (event) {
        event.preventDefault();
        // console.log('Select different airports');
        $('#offcanvasScrolling').offcanvas('hide');
        $('#offcanvasRightScrolling').offcanvas('hide');

        // clear the markers
        clickedMarkers = [];
        // clear the elevation array
        airportElevationArray = [];
        // clear the airports array
        airportsArray = [];
        // clear polyline
        map.eachLayer((layer) => {
            if (layer instanceof L.Polyline) {
                map.removeLayer(layer);
            }
        });

        // hide popup
        map.closePopup();

        // clear the offcanvas
        const offCanvasBody = $('#airports');
        offCanvasBody.html('');
        const selectedAirplane = $('#selectedAirplanes');
        selectedAirplane.html('');

    });
}

const addAirplaneToCart = (plane) => {

    const selectedAirplane = $('#selectedAirplanes');
    selectedAirplane.html(`
        <div class="card mb-3" style="width: 18rem;">
            <div class="card-body">
                <h5 class="card-title">${plane.type_of_plane}</h5>
                <p class="card-text">
                    <strong>Speed:</strong> ${plane.speed_kph} km/h<br>
                    <strong>Max Takeoff Altitude:</strong> ${plane.maxTakeOffAlt} ft<br>
                    <strong>Seats Remaining:</strong> ${plane.seats_remaining}<br>
                    <strong>Price per km:</strong> ${plane.price_per_km}<br>
                    <strong>Extra Fuel Charge:</strong> ${plane.extraFuelCharge}<br>
                </p>
            </div>
        </div>
    `);

    // Calculate the cost
    let totalCost = distance * plane.price_per_km;
    if (isItRaining) {
        totalCost *= plane.extraFuelCharge;
    }

    lengthOfFlight = calculateLengthOfFlight(plane.speed_kph);

    // if hour > 1 make hr hrs
    let lengthOfFlightString = lengthOfFlight > 1 ? 'hrs' : 'hr';

    const costDiv = $('#cost');
    costDiv.html(`
            <div class="card mb-3" style="width: 18rem;">
                <div class="card-body">
                    <h5 class="card-title">Cost</h5>
                    <p class="card-text">
                        <strong>Distance:</strong> ${distance.toFixed(2)}<br>
                        <strong>Price per km:</strong> ${plane.price_per_km}<br>
                        ${isItRaining ? `<strong>Extra Fuel Charge:</strong> ${plane.extraFuelCharge}<br>` : ''}
                        <strong>Length of Flight:</strong> ${lengthOfFlight.toFixed(2)}${lengthOfFlightString}<br>
                        <strong>Total Cost:</strong> ${totalCost.toFixed(2)}
                    </p>
                </div>
            </div>
             <div class="card mb-3" style="width: 18rem;">
                <button type="button" class="btn btn-primary" id="bookFlight">Book Flight</button>
                </div>
                <div class="card mb-3" style="width: 18rem;">
                <button type="button" class="btn btn-primary" id="selectAirplaneAgain">Select Different Plane</button>
                </div>
                <div class="card mb-3" style="width: 18rem;">
                <button type="button" class="btn btn-primary" id="seeMath">See Cost Breakdown</button>
            </div>
    `);

    // Attach event listener to the select different plane button
    const selectDifferentPlaneButton = $('#selectAirplaneAgain');
    selectDifferentPlaneButton.on('click', function (event) {
        event.preventDefault();
        resetAirplaneSelection();
    });

    // save to localstorage
    localStorage.setItem('selectedPlane', JSON.stringify(plane));
    localStorage.setItem('totalCost', totalCost.toString());
    localStorage.setItem('lengthOfFlight', lengthOfFlight);
}

const resetAirplaneSelection = () => {
    const selectedAirplane = $('#selectedAirplanes');
    selectedAirplane.html('');
    const costDiv = $('#cost');
    costDiv.html('');

    // open the right offcanvas
    $('#offcanvasRightScrolling').offcanvas('show');

    // close popup
    map.closePopup();
}

const fetchAndFilterAirplanes = async (elevation) => {
    try {
        const response = await fetch('static/public/fake_flights.json'); // Adjust the path as necessary
        const airplanesData = await response.json();

        // First filter the raw data
        const suitableAirplaneData = airplanesData.filter(airplane => airplane.maxTakeOffAlt >= elevation);

        const airplanes = suitableAirplaneData.map(airplane => new Airplane(
            airplane.speed_kph,
            airplane.type_of_plane,
            airplane.maxTakeOffAlt,
            airplane.seats_remaining,
            airplane.price_per_km,
            airplane.extraFuelCharge
        ));

        // console.log(airplanes);
        updateOffCanvasContentRight(airplanes);
    } catch (error) {
        console.error('Failed to load airplane data:', error);
    }
};

initializeMap();
// buildAirports();
