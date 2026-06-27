// SKYLINE WEATHER STATION — script.js
// Uses WeatherAPI.com (needs a free API key)

// Paste your own key from weatherapi.com between the quotes.
const apiKey = "fd0684ca48b34d7197e105518262606";

const searchForm = document.getElementById("searchForm");
const cityInput = document.getElementById("cityInput");
const geoBtn = document.getElementById("geoBtn");
const modeToggle = document.getElementById("modeToggle");
const modeIcon = document.getElementById("modeIcon");

const statusEl = document.getElementById("status");
const skyEl = document.getElementById("sky");
const starsEl = document.getElementById("stars");

const cityNameEl = document.getElementById("cityName");
const dateTimeEl = document.getElementById("dateTime");
const clockTimeEl = document.getElementById("clockTime");
const tempValueEl = document.getElementById("tempValue");
const unitToggle = document.getElementById("unitToggle");
const weatherIconEl = document.getElementById("weatherIcon");
const conditionTextEl = document.getElementById("conditionText");

const feelsLikeEl = document.getElementById("feelsLike");
const windSpeedEl = document.getElementById("windSpeed");
const humidityEl = document.getElementById("humidity");
const precipitationEl = document.getElementById("precipitation");
const uvIndexEl = document.getElementById("uvIndex");
const sunriseEl = document.getElementById("sunrise");
const sunsetEl = document.getElementById("sunset");

const gaugesEl = document.getElementById("gauges");
const detailOverlay = document.getElementById("detailOverlay");
const detailTitle = document.getElementById("detailTitle");
const detailList = document.getElementById("detailList");
const detailClose = document.getElementById("detailClose");

const hourlyStripEl = document.getElementById("hourlyStrip");
const dailyListEl = document.getElementById("dailyList");
const recentListEl = document.getElementById("recentList");

let currentUnit = "celsius";    // "celsius" or "fahrenheit"
let weatherData = null;         // the last weather data we received from the API
let currentPlace = null;        // { name, country } of the place we last looked up
let recentSearches = [];        // list of past city names, newest first
let nightOverride = null;       // null = use real day/night. "day" or "night" = user forced it with the button
let placeTimeZone = null;       // the searched city's timezone, e.g. "Asia/Karachi"

// Picks Celsius or Fahrenheit (API gives us both already) and rounds it.
function formatTemp(celsiusValue, fahrenheitValue) {
  if (currentUnit === "fahrenheit") {
    return Math.round(fahrenheitValue) + "°";
  }
  return Math.round(celsiusValue) + "°";
}

// Show a message under the search bar (and turn it red if it's an error)
function setStatus(message, isError) {
  statusEl.textContent = message;
  if (isError) {
    statusEl.classList.add("is-error");
  } else {
    statusEl.classList.remove("is-error");
  }
}

// Writes the current time into the clock element, using the
// searched city's own timezone instead of the visitor's device time.
function updateClock() {
  const now = new Date();
  if (placeTimeZone) {
    clockTimeEl.textContent = now.toLocaleTimeString(undefined, { timeZone: placeTimeZone });
  } else {
    clockTimeEl.textContent = now.toLocaleTimeString();
  }
}

// Turns a WeatherAPI.com condition code into a simple mood word.
function getMoodFromCode(code) {
  if (code === 1000) {
    return "clear";
  }
  if (code >= 1003 && code <= 1030) {
    return "cloudy";
  }
  if (code >= 1063 && code <= 1201) {
    return "rain";
  }
  if (code >= 1204 && code <= 1237) {
    return "snow";
  }
  if (code >= 1240 && code <= 1264) {
    return "rain";
  }
  if (code >= 1273) {
    return "storm";
  }
  return "cloudy";
}

// One SVG icon per mood, used by getWeatherIconSvg below.
const weatherIcons = {
  clear: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff9d3d" stroke-width="2"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>',
  night: '<svg viewBox="0 0 24 24" fill="none" stroke="#5ce1c9" stroke-width="2"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  cloudy: '<svg viewBox="0 0 24 24" fill="none" stroke="#8b97a3" stroke-width="2"><path d="M7 17a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 11 3.5 3.5 0 0 1 17 17H7z"/></svg>',
  rain: '<svg viewBox="0 0 24 24" fill="none" stroke="#1aa6a0" stroke-width="2"><path d="M7 15a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 15H7z"/><path d="M8 19l-1 2M12 19l-1 2M16 19l-1 2"/></svg>',
  snow: '<svg viewBox="0 0 24 24" fill="none" stroke="#9aa6bd" stroke-width="2"><path d="M7 15a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 9 3.5 3.5 0 0 1 17 15H7z"/><path d="M9 19l.01.01M12 20l.01.01M15 19l.01.01"/></svg>',
  storm: '<svg viewBox="0 0 24 24" fill="none" stroke="#ff9d3d" stroke-width="2"><path d="M7 14a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 8 3.5 3.5 0 0 1 17 14H7z"/><path d="M13 14l-3 5h3l-2 4"/></svg>',
};

// Return an SVG icon (as text) for a given mood + whether it's night.
function getWeatherIconSvg(mood, isNight) {
  if (mood === "clear" && isNight) {
    return weatherIcons.night;
  }
  return weatherIcons[mood] || weatherIcons.cloudy;
}

// Gets current weather + forecast for a city name or "lat,lon".
async function getWeather(place) {
  const url = "https://api.weatherapi.com/v1/forecast.json"
    + "?key=" + apiKey
    + "&q=" + encodeURIComponent(place)
    + "&days=5"
    + "&aqi=no"
    + "&alerts=no";

  const response = await fetch(url);
  const data = await response.json();

  // If the API key is wrong or the city doesn't exist, WeatherAPI.com
  // sends back an "error" object instead of weather data.
  if (data.error) {
    throw new Error(data.error.message);
  }

  return data;
}

// Ask the browser for the user's GPS location (with permission).
function getUserLocation() {
  return new Promise(function (resolve, reject) {
    if (!navigator.geolocation) {
      reject(new Error("Your browser doesn't support location."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      function (position) {
        resolve(position.coords);
      },
      function () {
        reject(new Error("Location permission was denied."));
      }
    );
  });
}

// Updates every part of the page using weatherData + currentPlace.
function renderPage() {
  if (!weatherData || !currentPlace) {
    return; // nothing to show yet
  }

  const current = weatherData.current;
  const today = weatherData.forecast.forecastday[0];
  const placeNow = placeTimeZone
    ? new Date(new Date().toLocaleString("en-US", { timeZone: placeTimeZone }))
    : new Date();
  const period = getDayPeriod(today.astro, placeNow); // "day", "evening", or "night"
  const mood = getMoodFromCode(current.condition.code);

  // ---- Background + day/evening/night theme ----
  setBackgroundTheme(mood, period);

  // ---- Place name and current date/time ----
  cityNameEl.textContent = currentPlace.name + ", " + currentPlace.country;
  dateTimeEl.textContent = new Date().toLocaleString(undefined, {
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: placeTimeZone || undefined,
  });

  // ---- Big temperature number ----
  tempValueEl.textContent = formatTemp(current.temp_c, current.temp_f);
  unitToggle.textContent = currentUnit === "celsius" ? "°C" : "°F";

  // ---- Condition text + icon ----
  conditionTextEl.textContent = current.condition.text;
  weatherIconEl.innerHTML = getWeatherIconSvg(mood, period === "night");

  // ---- The four small gauges ----
  feelsLikeEl.textContent = formatTemp(current.feelslike_c, current.feelslike_f);
  windSpeedEl.textContent = Math.round(current.wind_kph) + " km/h";
  humidityEl.textContent = current.humidity + "%";
  precipitationEl.textContent = current.precip_mm.toFixed(1) + "mm";
  uvIndexEl.textContent = today.day.uv.toFixed(1);
  sunriseEl.textContent = today.astro.sunrise;
  sunsetEl.textContent = today.astro.sunset;

  // ---- Hourly strip and 5-day list ----
  renderHourly();
  renderDaily();
}

// Turns a time string like "6:42 PM" into minutes since midnight (0-1439),
// so we can compare it against the current time.
function timeStringToMinutes(timeText) {
  const parts = timeText.split(" "); // ["6:42", "PM"]
  const hourMinute = parts[0].split(":");
  let hour = parseInt(hourMinute[0], 10);
  const minute = parseInt(hourMinute[1], 10);
  const isPM = parts[1] === "PM";

  if (isPM && hour !== 12) {
    hour = hour + 12;
  }
  if (!isPM && hour === 12) {
    hour = 0;
  }

  return hour * 60 + minute;
}

// Works out day / evening / night for the searched place, using its own
// local time plus today's real sunrise and sunset times.
function getDayPeriod(astro, placeNow) {
  const nowMinutes = placeNow.getHours() * 60 + placeNow.getMinutes();
  const sunriseMinutes = timeStringToMinutes(astro.sunrise);
  let sunsetMinutes = timeStringToMinutes(astro.sunset);
  const eveningWindow = 60; // minutes of "evening" around sunrise/sunset

  // In far-north places during summer, sunset can land after midnight
  // (e.g. 12:03 AM), which is numerically SMALLER than sunrise. Push it
  // past 24 hours (1440 minutes) so the comparisons below stay correct.
  if (sunsetMinutes < sunriseMinutes) {
    sunsetMinutes = sunsetMinutes + 1440;
  }

  // Compare "now" against sunset both as-is and shifted forward a day,
  // so a sunset just after midnight still reads as "close to now".
  const nearSunset = Math.abs(nowMinutes - sunsetMinutes) <= eveningWindow
    || Math.abs(nowMinutes + 1440 - sunsetMinutes) <= eveningWindow;
  const nearSunrise = Math.abs(nowMinutes - sunriseMinutes) <= eveningWindow;

  if (nearSunset || nearSunrise) {
    return "evening";
  }
  if (nowMinutes > sunriseMinutes && nowMinutes < sunsetMinutes) {
    return "day";
  }
  return "night";
}

// Changes the sky's colors and shows/hides the sun, moon, and stars.
function setBackgroundTheme(mood, period) {
  // Reset classes, then add the current mood as a class (for rain/storm tint).
  skyEl.className = "sky";
  skyEl.classList.add("is-" + mood);

  // The manual button (nightOverride) wins if it's set, otherwise we
  // use the real day/evening/night period worked out from sunrise/sunset.
  const mode = nightOverride !== null ? nightOverride : period;

  document.body.setAttribute("data-mode", mode);
  updateModeButtonIcon(mode);
}

// Icon shown inside the day/night toggle button: shows what you'll switch TO.
const modeIcons = {
  day: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  night: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  evening: '<circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M2 12h2M20 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4"/>',
};
function updateModeButtonIcon(mode) {
  modeIcon.innerHTML = mode === "night" ? modeIcons.night : modeIcons.day;
}

// Creates the small twinkling star dots inside the night sky.
// Runs only once, when the page first loads.
function createStars() {
  starsEl.innerHTML = "";
  const numberOfStars = 60;

  for (let i = 0; i < numberOfStars; i++) {
    const star = document.createElement("div");
    star.className = "star";
    star.style.left = Math.random() * 100 + "%";
    star.style.top = Math.random() * 55 + "%";
    star.style.animationDelay = (Math.random() * 3) + "s";
    starsEl.appendChild(star);
  }
}

// Joins today's + tomorrow's hourly lists and returns the next 24 hours
// starting from right now. Used by renderHourly and the detail popup.
function getNext24Hours() {
  const todayHours = weatherData.forecast.forecastday[0].hour;
  const tomorrowHours = weatherData.forecast.forecastday[1].hour;
  const allHours = todayHours.concat(tomorrowHours);

  const now = new Date();
  let startIndex = 0;
  for (let i = 0; i < allHours.length; i++) {
    if (new Date(allHours[i].time) >= now) {
      startIndex = i;
      break;
    }
  }

  return allHours.slice(startIndex, startIndex + 24);
}

// Builds the 24-hour scrolling strip using today's + tomorrow's hours.
function renderHourly() {
  hourlyStripEl.innerHTML = "";
  const next24 = getNext24Hours();

  for (let i = 0; i < next24.length; i++) {
    const hour = next24[i];
    const hourDate = new Date(hour.time);
    const hourLabel = hourDate.toLocaleTimeString(undefined, { hour: "numeric" });
    const mood = getMoodFromCode(hour.condition.code);
    const tempText = formatTemp(hour.temp_c, hour.temp_f);

    const card = document.createElement("div");
    card.className = "hour-card";
    card.innerHTML =
      '<div class="hour-card__time">' + hourLabel + '</div>' +
      getWeatherIconSvg(mood, false) +
      '<div class="hour-card__temp">' + tempText + '</div>';

    hourlyStripEl.appendChild(card);
  }
}

// Three metrics that can be opened in detail: each has a title, a unit
// label, and a function that reads its value off one hourly entry.
const metricInfo = {
  wind: {
    title: "Wind speed — next 24 hours",
    getValue: function (hour) {
      return Math.round(hour.wind_kph) + " km/h";
    },
  },
  humidity: {
    title: "Humidity — next 24 hours",
    getValue: function (hour) {
      return hour.humidity + "%";
    },
  },
  precipitation: {
    title: "Precipitation — next 24 hours",
    getValue: function (hour) {
      return hour.precip_mm.toFixed(1) + "mm";
    },
  },
};

// Opens the popup and fills it with 24 rows of whichever metric was clicked.
function openMetricDetail(metric) {
  const info = metricInfo[metric];
  if (!info || !weatherData) {
    return;
  }

  detailTitle.textContent = info.title;
  detailList.innerHTML = "";

  const next24 = getNext24Hours();
  for (let i = 0; i < next24.length; i++) {
    const hour = next24[i];
    const hourDate = new Date(hour.time);
    const hourLabel = hourDate.toLocaleTimeString(undefined, { hour: "numeric" });

    const row = document.createElement("div");
    row.className = "detail-row";
    row.innerHTML =
      '<span class="detail-row__time">' + hourLabel + '</span>' +
      '<span class="detail-row__value">' + info.getValue(hour) + '</span>';

    detailList.appendChild(row);
  }

  detailOverlay.classList.add("is-open");
}

function closeMetricDetail() {
  detailOverlay.classList.remove("is-open");
}

// Builds the 5-day forecast list.
function renderDaily() {
  dailyListEl.innerHTML = "";

  const days = weatherData.forecast.forecastday;

  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const date = new Date(day.date);

    const dayLabel = i === 0 ? "Today" : date.toLocaleDateString(undefined, { weekday: "short" });
    const shortDate = date.toLocaleDateString(undefined, { day: "numeric", month: "short" });

    const mood = getMoodFromCode(day.day.condition.code);
    const maxText = formatTemp(day.day.maxtemp_c, day.day.maxtemp_f);
    const minText = formatTemp(day.day.mintemp_c, day.day.mintemp_f);

    const row = document.createElement("div");
    row.className = "day-row";
    row.innerHTML =
      '<div class="day-row__name">' + dayLabel + '<span>' + shortDate + '</span></div>' +
      '<div class="day-row__icon">' + getWeatherIconSvg(mood, false) + '</div>' +
      '<div></div>' +
      '<div class="day-row__range"><b>' + maxText + '</b> / ' + minText + '</div>';

    dailyListEl.appendChild(row);
  }
}

// Redraws the row of clickable "recent search" chips.
function renderRecent() {
  recentListEl.innerHTML = "";

  for (let i = 0; i < recentSearches.length; i++) {
    const city = recentSearches[i];

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "recent-chip";
    chip.textContent = city;

    // When clicked, search for that city again.
    chip.addEventListener("click", function () {
      searchForCity(city);
    });

    recentListEl.appendChild(chip);
  }
}

// Runs the full search: city name -> weather -> draw page.
async function searchForCity(cityName) {
  if (!cityName || cityName.trim() === "") {
    setStatus("Please type a city name.", true);
    return;
  }

  setStatus('Searching for "' + cityName + '"…', false);

  try {
    const data = await getWeather(cityName);

    weatherData = data;
    currentPlace = { name: data.location.name, country: data.location.country };
    placeTimeZone = data.location.tz_id;
    nightOverride = null; // ← RESET: let the new city's real time decide day/evening/night

    renderPage();
    updateClock();
    addToRecentSearches(data.location.name);

    setStatus("Updated · " + data.location.name + ", " + data.location.country, false);
  } catch (error) {
    // If anything above goes wrong (bad city name, wrong API key, network error),
    // we land here instead of crashing the page.
    setStatus(error.message, true);
  }
}

// Uses the browser's GPS to show weather for where the user actually is.
async function useMyLocation() {
  setStatus("Getting your location…", false);

  try {
    const coords = await getUserLocation();
    const place = coords.latitude + "," + coords.longitude;
    const data = await getWeather(place);

    weatherData = data;
    currentPlace = { name: data.location.name, country: data.location.country };
    placeTimeZone = data.location.tz_id;
    nightOverride = null; // ← RESET: let the detected location's real time decide day/evening/night

    renderPage();
    updateClock();
    setStatus("Updated · " + data.location.name, false);
  } catch (error) {
    setStatus(error.message, true);
  }
}

// Adds a city to the recent-searches list (newest first, no duplicates, max 5).
function addToRecentSearches(cityName) {
  // Remove this city if it's already in the list.
  const filtered = [];
  for (let i = 0; i < recentSearches.length; i++) {
    if (recentSearches[i].toLowerCase() !== cityName.toLowerCase()) {
      filtered.push(recentSearches[i]);
    }
  }

  // Put the new city at the front.
  filtered.unshift(cityName);

  // Keep only the 5 most recent.
  recentSearches = filtered.slice(0, 5);

  renderRecent();
}

// When the search form is submitted (Enter key or search button click).
searchForm.addEventListener("submit", function (event) {
  event.preventDefault(); // stop the page from reloading
  searchForCity(cityInput.value);
  cityInput.value = "";
});

// "Use my location" button.
geoBtn.addEventListener("click", useMyLocation);

// °C / °F toggle button. Re-draws using the SAME data (no new fetch needed).
unitToggle.addEventListener("click", function () {
  currentUnit = currentUnit === "celsius" ? "fahrenheit" : "celsius";
  renderPage();
});

// Day/night toggle button. Lets the user force day or night manually
// (the automatic "evening" theme only appears when this isn't set).
modeToggle.addEventListener("click", function () {
  const currentMode = document.body.getAttribute("data-mode");
  nightOverride = currentMode === "night" ? "day" : "night";
  renderPage();
});

// One listener on the whole gauges row catches clicks on any of the
// three clickable gauges (wind, humidity, precipitation) and opens
// the matching 24-hour detail popup.
gaugesEl.addEventListener("click", function (event) {
  const button = event.target.closest(".gauge--clickable");
  if (button) {
    openMetricDetail(button.dataset.metric);
  }
});

// Close the popup via its × button, or by clicking the dark area behind it.
detailClose.addEventListener("click", closeMetricDetail);
detailOverlay.addEventListener("click", function (event) {
  if (event.target === detailOverlay) {
    closeMetricDetail();
  }
});

createStars();
setStatus("Loading your local weather…", false);

// Show the correct time immediately, then keep it updating every second.
updateClock();
setInterval(updateClock, 1000);

useMyLocation().catch(function () {
  // If location access is blocked, just show a default city instead.
  searchForCity("Karachi");
});