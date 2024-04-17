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
let airportIcon = L.icon({
    iconUrl: 'static/img/airport-location.png',
    iconSize: [32, 32],      // Define size, adjust as necessary
    iconAnchor: [16, 16],    // Define anchor, adjust as necessary
    popupAnchor: [0, -16]    // Define popup anchor, adjust as necessary
});
let isLoggedIn = false;
const images = [
    'static/img/planes/plane1.webp',
    'static/img/planes/plane2.webp',
    'static/img/planes/plane3.webp',
    'static/img/planes/plane4.webp',
    'static/img/planes/plane5.webp',
    'static/img/planes/plane6.webp',
    'static/img/planes/plane7.webp',
    'static/img/planes/plane8.webp',
    'static/img/planes/plane10.webp',
    'static/img/planes/plane11.webp',
]

window.onload = function() {
    // Retrieve data from localStorage
    const selectedPlane = JSON.parse(localStorage.getItem('selectedPlane'));
    const selectedAirports = JSON.parse(localStorage.getItem('selectedAirports'));
    distance = parseFloat(localStorage.getItem('distance'));
    totalCost = parseFloat(localStorage.getItem('totalCost'));
    lengthOfFlight = parseFloat(localStorage.getItem('lengthOfFlight'));
    isLoggedIn = JSON.parse(localStorage.getItem('isLoggedIn'));

    if (selectedPlane && selectedAirports) {
        updateOffCanvasContentLeft(selectedAirports);
        addAirplaneToCart(selectedPlane);
        $('#offcanvasScrolling').offcanvas('show');
    }
};

/**
 * Get a random image path from the images array
 * @returns {string}
 */
const getRandomImagePath = () => {
    const randomIndex = Math.floor(Math.random() * images.length);
    return images[randomIndex];
}

/**
 * Get weather information from OpenWeatherMap API
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns {Promise<{temperature: *, description: *}>}
 */
const getWeatherInfo = async (lat, lng) => {
    try {
        const response = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${APIKEY}&units=metric`);

        const data = await response.json();

        return {
            temperature: data.main.temp,
            description: data.weather[0].description,
        };

    } catch (error) {
        console.error(error)
    }
}

/**
 * Initialize the map
 */
const initializeMap = () => {

    // Define the bounds of the map
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

    // Add the tile layers
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

    // Add the layer control
    L.control.layers({
        "OpenStreetMap": osmLayer,
        "Thunderforest SpinalMap": thunderforestLayer,
        "Stadia Alidade Smooth Dark": Stadia_AlidadeSmoothDark
    }).addTo(map);



    L.marker([51.5, -0.09], { icon: airportIcon }).addTo(map)
        .on('add', () => console.log("Marker added"))  // Debug successful add
        .on('error', (e) => console.error("Error adding marker:", e));  // Debug any errors

    setTimeout(buildAirports, 250);
};

/**
 * Build the airports on the map
 */
const buildAirports = () => {
    fetch('static/public/mAirports.json')
        .then(response => response.json())
        .then(airports => {

            // Loop through the airports and add markers to the map
            airports.forEach(airport => {
                const [lat, lng] = convertDMSToDecimal(airport["Geographic Location"]);
                let marker = L.marker([lat, lng], {icon: airportIcon}).addTo(map);  // Corrected here

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

                    // Add the airport to the array
                    if (airportElevationArray.length < 2) {
                        airportElevationArray.push(airport["elevationInFt"]);

                        // Add the airport to the array by creating a new Airports object
                        airportsArray.push(new Airports(airport["City Name"], airport["Airport Name"], airport["Country"], airport["elevationInFt"], lat, lng));
                    } else {
                        // If there are already two airports in the array, replace the second one
                        airportElevationArray = [];
                        airportsArray = [];
                        airportsArray.push(new Airports(airport["City Name"], airport["Airport Name"], airport["Country"], airport["elevationInFt"], lat, lng));
                        airportElevationArray.push(airport["elevationInFt"]);
                    }

                    // Filter airplanes based on elevation of the first airport
                    if (airportElevationArray.length === 2) {
                        fetchAndFilterAirplanes(Math.max(...airportElevationArray));
                        updateOffCanvasContentLeft(airportsArray);
                    }
                });

                marker.bindPopup("Click to load weather data");
            });
        });
};

/**
 * Airplane class to store airplane data
 */
class Airplane {
    constructor(speed_kph, type_of_plane, seats_remaining, price_per_km, extraFuelCharge, maxTakeOffAlt, imagePath) {
        this.type_of_plane = type_of_plane;
        this.speed_kph = speed_kph;
        this.maxTakeOffAlt = maxTakeOffAlt;
        this.seats_remaining = seats_remaining;
        this.price_per_km = price_per_km;
        this.extraFuelCharge = extraFuelCharge;
        this.imagePath = imagePath;
    }
}

/**
 * Airports class to store airport data
 */
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

/**
 * Handle marker click event
 * @param marker - The marker that was clicked
 */
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

/**
 * Create the popup content
 * @param airport - The airport object
 * @param weatherInfo - The weather information
 */
const createPopupContent = (airport, weatherInfo) => `
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

/**
 * Convert DMS to decimal
 * @param coordinate - The coordinate in DMS format
 * @returns {[*,*]}
 */
const convertDMSToDecimal = (coordinate) => {
    const [lat, lon] = coordinate.split(' ');

    // Convert the latitude and longitude to decimal
    const convertPart = (part) => {
        const direction = part.slice(-1);
        const degrees = parseInt(part.slice(0, -3), 10);
        const minutes = parseInt(part.slice(-3, -1), 10) / 60;
        // Return the decimal value based on the direction
        return (direction === 'S' || direction === 'W') ? -(degrees + minutes) : degrees + minutes;
    };

    return [convertPart(lat), convertPart(lon)];
};

/**
 * Update the content of the off-canvas
 * @param airportsArray - The array of airports
 */
const updateOffCanvasContentLeft = (airportsArray) => {

    // Check if the array is empty
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

/**
* Calculate the length of the flight
 * @param speed - The speed of the airplane
 * @returns {number}
 */
const calculateLengthOfFlight = (speed) => {
    return distance / speed; // Time in hours

}

/**
 * Update the content of the right off-canvas
 * @param airplanes
 */
const updateOffCanvasContentRight = (airplanes) => {
    const offCanvasBody = $('#offcanvasRightScrolling .offcanvas-body');

    let content = airplanes.map(((plane, index) => `
        <div class="card mb-3" style="width: 18rem;">
          <img src="${plane.imagePath}" class="card-img-top" alt="Airplane">
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



    // Prepend the sort selector
    offCanvasBody.prepend(`
        <div class="sort-selector mb-3">
            <select class="form-select" id="sort-planes">
                <option value="maxTakeOffAlt">Max Takeoff Altitude</option>
                <option value="price_per_km">Price per km</option>
                <option value="speed_kph">Speed</option>
            </select>
        </div>
    `);

    // Attach event listeners
    attachButtonListenersRightCanvas(airplanes);
}

/**
 * Attach event listeners to the buttons in the right off-canvas
 * @param airplanes - The array of airplanes
 */
const attachButtonListenersRightCanvas = (airplanes) => {
    const buttons = $('.plane-select-button');
    buttons.on('click', function (event) {
        event.preventDefault();
        const index = $(this).data('plane-index');
        const selectedPlane = airplanes[index];

        addAirplaneToCart(selectedPlane);

        // close the right offcanvas
        $('#offcanvasRightScrolling').offcanvas('hide');
    });
}

/**
 * Attach event listeners to the buttons in the left off-canvas
 */
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

/**
 * Add the airplane to the cart
 * @param plane - The airplane object
 */
const addAirplaneToCart = (plane) => {

    const selectedAirplane = $('#selectedAirplanes');
    selectedAirplane.html(`
        <div class="card mb-3" style="width: 18rem;">
            <img src="${plane.imagePath}" class="card-img-top" alt="Airplane">
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
             <div class="logged-buttons">
                <!-- buttons go here -->
            </div>
            <div class="card mb-3" id="login-button" style="width: 18rem;">
                <button type="button" class="btn btn-primary" id="login">Register</button>
            </div>
    `);

    // Check if the user is logged in
    if (isLoggedIn) {
        buildButtons();
    }

    // Attach event listener to login
    const loginButton = $('#login');
    loginButton.on('click', function (event) {
        console.log('Login');
        event.preventDefault();
        const modal = $('#login-modal');
        modal.modal('show');
    });

    // Save to localstorage
    localStorage.setItem('selectedPlane', JSON.stringify(plane));
    localStorage.setItem('totalCost', totalCost.toString());
    localStorage.setItem('lengthOfFlight', lengthOfFlight);

    const selectedAirplaneLocalStorage = localStorage.getItem('selectedAirports');
    const selectedAirplanes = JSON.parse(selectedAirplaneLocalStorage);

    // Attach event listener to the book flight button
    const bookFlightButton = $('#bookFlight');
    bookFlightButton.on('click', function (event) {
        event.preventDefault();
        const modal = $('#shoppingCartModal');
        modal.modal('show');

        // Update the modal content
        console.log("Updating modal content");
        const modalBody = $('#bobby');
        console.log(modalBody.length);  // Check if the element is being selected correctly
        modalBody.html(`
            <h5 class="modal-title">Flight Booking</h5>
            <p>You have successfully booked a flight from <strong>${selectedAirplanes[0].city}</strong> to <strong>${selectedAirplanes[1].city}</strong>.</p>
            <p>The total cost of the flight is $${totalCost.toFixed(2)}.</p>
            <p>The flight will take approximately ${lengthOfFlight.toFixed(2)} hours.</p>
        `);
    });
}

/**
 * Display the math breakdown
 */
const MathBreakdown = () => {
    const selectedAirplaneLocalStorage = localStorage.getItem('selectedPlane');
    const selectedAirplane = JSON.parse(selectedAirplaneLocalStorage);

    let math = distance * selectedAirplane.price_per_km;

    const costDiv = $('#costBreakdown');
    costDiv.html(`
        <strong>Distance:</strong> ${distance.toFixed(2)}<br>
        <strong>Price per km:</strong> ${selectedAirplane.price_per_km}<br>
        ${isItRaining ? `<strong>Extra Fuel Charge:</strong> ${selectedAirplane.extraFuelCharge}<br>` : ''}<br>
        <strong>Length of Flight:</strong> ${lengthOfFlight.toFixed(2)} hrs<br>
        <strong>Total Cost:</strong> ${totalCost.toFixed(2)}
        <br>
        <br>
        <strong>Math:</strong> ${distance.toFixed(2)} * ${selectedAirplane.price_per_km} = ${math.toFixed(2)}<br>
    `);

    const modal = $('#costBreakdownModal');
    modal.modal('show');
}

/**
 * Reset the airplane selection
 */
const resetAirplaneSelection = () => {
    const selectedAirplane = $('#selectedAirplanes');
    selectedAirplane.html('');
    const costDiv = $('#cost');
    costDiv.html('');

    // open the right off-canvas
    $('#offcanvasRightScrolling').offcanvas('show');

    // close popup
    map.closePopup();
}

/**
 * Fetch and filter airplanes based on the elevation
 * @param elevation
 * @returns {Promise<void>}
 */
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
            airplane.extraFuelCharge,
            getRandomImagePath()
        ));

        updateOffCanvasContentRight(airplanes);
    } catch (error) {
        console.error('Failed to load airplane data:', error);
    }
};

/**
 * Build the buttons used after the user is logged in
 */
const buildButtons = () => {
    if (isLoggedIn) {
        const buttons = $('.logged-buttons');
        buttons.html(`
        <div class="card mb-3" style="width: 18rem;">
            <button type="button" class="btn btn-primary" id="bookFlight">Book Flight</button>
        </div>
        <div class="card mb-3" style="width: 18rem;">
            <button type="button" class="btn btn-primary" id="selectAirplaneAgain">Select Different Plane</button>
        </div>
        <div class="card mb-3" style="width: 18rem;">
            <button type="button" class="btn btn-primary" id="seeMath">See Math</button>
        </div>
        `);

        // hide the login button
        const loginButton = $('#login-button');
        loginButton.hide();

        // Attach event listener to the select different plane button
        const selectDifferentPlaneButton = $('#selectAirplaneAgain');
        selectDifferentPlaneButton.on('click', function (event) {
            event.preventDefault();
            resetAirplaneSelection();
        });

        // Attach event listener to the see cost breakdown button
        const seeMathButton = $('#seeMath');
        seeMathButton.on('click', function (event) {
            event.preventDefault();
            MathBreakdown();
        });
    }
}

/**
 * Verifies the form inputs
 * @returns {boolean}
 */
const verifyForm = () => {
    const registerForm = $('#register-user-form');

    if (registerForm[0].checkValidity()) {
        console.log('Form is valid');
        $('#login-modal').modal('hide');
        return true;
    } else {
        console.log('Form is invalid');
        return false;
    }
}

/**
 * Clear the form inputs
 */
const clearFormInputs = () => {
    $('#first-name').val('');
    $('#last-name').val('');
    $('#phone-number').val('');
    $('#email').val('');
    $('#age').val('');
    $('#postal-code').val('');
}

/**
 * Clear invalid inputs
 */
const clearInvalidInputs = () => {
    const $firstName = $('#first-name');
    if (!/^[A-Za-z]+$/.test($firstName.val())) {
        $firstName.val('');
    }

    const $lastName = $('#last-name');
    if (!/^[A-Za-z]+$/.test($lastName.val())) {
        $lastName.val('');
    }

    const $phoneNumber = $('#phone-number');
    if (!/^(?:\d{3}-\d{3}-\d{4}|\d{10}|\d{3} \d{3} \d{4})$/.test($phoneNumber.val())) {
        $phoneNumber.val('');
    }

    const $email = $('#email');
    if (!/[^@\s]+@[^@\s]+\.[^@\s]+/.test($email.val())) {
        $email.val('');
    }

    const $age = $('#age');
    if ($age.val() < 0 || $age.val() > 120) {
        $age.val('');
    }

    const $postalCode = $('#postal-code');
    if (!/^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/.test($postalCode.val())) {
        $postalCode.val('');
    }
}

// Event listeners for the register button
$("#register-submit-btn").on("click", () => {
    clearInvalidInputs();

    // Verify the form inputs
    if (verifyForm()) {
        isLoggedIn = true;
        localStorage.setItem('isLoggedIn', JSON.stringify(isLoggedIn));
        clearFormInputs();
        buildButtons();
        window.location.reload();
    }
});

// Event listener for the logout button
$("#checkout").on("click", () => {
    const modal = $('#shoppingCartModal');
    modal.modal('hide');

    // close the right offcanvas
    $('#offcanvasRightScrolling').offcanvas('hide');
    // close the left offcanvas
    $('#offcanvasScrolling').offcanvas('hide');

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

    // clear localstorage
    localStorage.clear();

    // clear the canvas
    const offCanvasBodyRight = $('#offcanvasRightScrolling .offcanvas-body');
    offCanvasBodyRight.html('');

    window.location.reload();
});

// Attach event listener to the select different plane button
const selectDifferentPlaneButton = $('#selectAirplaneAgain');
selectDifferentPlaneButton.on('click', function (event) {
    event.preventDefault();
    resetAirplaneSelection();
});

// Attach event listener to the see cost breakdown button
const seeMathButton = $('#seeMath');
seeMathButton.on('click', function (event) {
    event.preventDefault();
    MathBreakdown();
});

initializeMap();
