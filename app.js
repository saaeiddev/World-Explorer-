(() => {
  "use strict";

  const GEO_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";
  const EARTH_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
  const EARTH_BUMP = "https://unpkg.com/three-globe/example/img/earth-topology.png";
  const COUNTRY_API = "https://restcountries.com/v3.1";

  const state = {
    globe: null,
    features: [],
    featureByCode: new Map(),
    countryCache: new Map(),
    hovered: null,
    selected: null,
    ready: false,
    selectionToken: 0
  };

  const el = {
    globe: document.getElementById("globe"),
    loading: document.getElementById("loading"),
    error: document.getElementById("globe-error"),
    panel: document.getElementById("country-panel"),
    close: document.getElementById("close-country"),
    search: document.getElementById("country-search"),
    results: document.getElementById("search-results"),
    random: document.getElementById("random-btn"),
    reset: document.getElementById("reset-btn"),
    quick: document.getElementById("quick-countries"),
    count: document.getElementById("country-count"),
    globeLabel: document.getElementById("globe-label"),
    lat: document.getElementById("lat-value"),
    lng: document.getElementById("lng-value"),
    image: document.getElementById("country-image"),
    flag: document.getElementById("country-flag"),
    name: document.getElementById("country-name"),
    region: document.getElementById("country-region"),
    summary: document.getElementById("country-summary"),
    capital: document.getElementById("stat-capital"),
    population: document.getElementById("stat-population"),
    language: document.getElementById("stat-language"),
    currency: document.getElementById("stat-currency"),
    area: document.getElementById("stat-area"),
    timezone: document.getElementById("stat-timezone"),
    continent: document.getElementById("detail-continent"),
    calling: document.getElementById("detail-calling"),
    driving: document.getElementById("detail-driving"),
    maps: document.getElementById("maps-link")
  };

  const aliasToWiki = new Map([
    ["United States of America", "United States"],
    ["Dem. Rep. Congo", "Democratic Republic of the Congo"],
    ["Congo", "Republic of the Congo"],
    ["Czechia", "Czech Republic"],
    ["eSwatini", "Eswatini"],
    ["Timor-Leste", "East Timor"]
  ]);

  const quickDestinations = [
    { code: "JPN", name: "Japan" },
    { code: "USA", name: "United States" },
    { code: "FRA", name: "France" },
    { code: "ITA", name: "Italy" },
    { code: "CAN", name: "Canada" },
    { code: "KOR", name: "South Korea" }
  ];

  const featureName = (feature) =>
    feature?.properties?.ADMIN ||
    feature?.properties?.NAME ||
    feature?.properties?.name ||
    "Unknown";

  const featureCode = (feature) =>
    feature?.properties?.ISO_A3 ||
    feature?.properties?.ADM0_A3 ||
    feature?.properties?.iso_a3 ||
    "";

  const featureCode2 = (feature) =>
    feature?.properties?.ISO_A2 ||
    feature?.properties?.iso_a2 ||
    "";

  const featureRegion = (feature) =>
    feature?.properties?.CONTINENT ||
    feature?.properties?.REGION_UN ||
    feature?.properties?.region ||
    "";

  const safe = (value, fallback = "—") =>
    value === undefined || value === null || value === "" ? fallback : value;

  const formatNumber = (value) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value)
      : "—";

  const formatArea = (value) =>
    Number.isFinite(value)
      ? new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) + " km²"
      : "—";

  function flagUrl(feature, width = 80) {
    const code2 = featureCode2(feature).toLowerCase();
    return /^[a-z]{2}$/.test(code2) ? "https://flagcdn.com/w" + width + "/" + code2 + ".png" : "";
  }

  function flattenCoordinates(coords, points = []) {
    if (!Array.isArray(coords)) return points;
    if (
      coords.length >= 2 &&
      typeof coords[0] === "number" &&
      typeof coords[1] === "number"
    ) {
      const lng = coords[0];
      const lat = coords[1];
      if (Number.isFinite(lat) && Number.isFinite(lng)) points.push([lat, lng]);
      return points;
    }
    coords.forEach((item) => flattenCoordinates(item, points));
    return points;
  }

  function featureCenter(feature) {
    const points = flattenCoordinates(feature?.geometry?.coordinates || []);
    if (!points.length) return { lat: 20, lng: 0 };

    let minLat = 90, maxLat = -90, minLng = 180, maxLng = -180;
    points.forEach(([lat, lng]) => {
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
    });

    return {
      lat: (minLat + maxLat) / 2,
      lng: (minLng + maxLng) / 2
    };
  }

  function setCoordinates(lat, lng) {
    const safeLat = Number.isFinite(lat) ? lat : 20;
    const safeLng = Number.isFinite(lng) ? lng : 0;
    el.lat.textContent = Math.abs(safeLat).toFixed(1) + "° " + (safeLat >= 0 ? "N" : "S");
    el.lng.textContent = Math.abs(safeLng).toFixed(1) + "° " + (safeLng >= 0 ? "E" : "W");
  }

  function getCountryColor(feature) {
    if (feature === state.selected) return "rgba(101,232,255,0.78)";
    if (feature === state.hovered) return "rgba(116,140,255,0.62)";
    return "rgba(63,101,166,0.16)";
  }

  function getCountryAltitude(feature) {
    if (feature === state.selected) return 0.025;
    if (feature === state.hovered) return 0.017;
    return 0.008;
  }

  function refreshPolygons() {
    if (!state.globe || !state.ready) return;
    try {
      state.globe
        .polygonCapColor(getCountryColor)
        .polygonAltitude(getCountryAltitude);
    } catch (error) {
      console.warn("Polygon refresh skipped:", error);
    }
  }

  function countryCurrency(country) {
    const currencies = Object.values(country?.currencies || {});
    if (!currencies.length) return "—";
    return currencies
      .slice(0, 2)
      .map((item) => item?.symbol ? safe(item.name) + " (" + item.symbol + ")" : safe(item?.name))
      .join(", ");
  }

  function countryLanguages(country) {
    const languages = Object.values(country?.languages || {});
    return languages.length ? languages.slice(0, 3).join(", ") : "—";
  }

  function callingCode(country) {
    const root = country?.idd?.root || "";
    const suffix = country?.idd?.suffixes?.[0] || "";
    return root ? root + suffix : "—";
  }

  async function fetchJson(url, timeout = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error("HTTP " + response.status);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  async function getCountryDetails(feature) {
    const code = featureCode(feature);
    const name = featureName(feature);
    const cacheKey = code && code !== "-99" ? code : name.toLowerCase();

    if (state.countryCache.has(cacheKey)) return state.countryCache.get(cacheKey);

    let data = null;
    try {
      if (code && code !== "-99") {
        const response = await fetchJson(COUNTRY_API + "/alpha/" + encodeURIComponent(code));
        data = Array.isArray(response) ? response[0] : response;
      } else {
        const response = await fetchJson(COUNTRY_API + "/name/" + encodeURIComponent(name) + "?fullText=true");
        data = Array.isArray(response) ? response[0] : response;
      }
    } catch (error) {
      console.warn("Country detail API unavailable for " + name + ":", error);
    }

    state.countryCache.set(cacheKey, data);
    return data;
  }

  async function getWikipediaProfile(countryName) {
    const pageName = aliasToWiki.get(countryName) || countryName;
    try {
      const title = encodeURIComponent(pageName.replaceAll(" ", "_"));
      const data = await fetchJson(
        "https://en.wikipedia.org/api/rest_v1/page/summary/" + title,
        7000
      );
      return {
        summary: data?.extract || "",
        image: data?.originalimage?.source || data?.thumbnail?.source || ""
      };
    } catch (error) {
      console.warn("Wikipedia profile unavailable for " + countryName + ":", error);
      return { summary: "", image: "" };
    }
  }

  function resetCountryFields(feature) {
    const name = featureName(feature);
    const region = featureRegion(feature);
    const fallbackFlag = flagUrl(feature, 160);

    el.name.textContent = name;
    el.region.textContent = region ? region.toUpperCase() : "COUNTRY PROFILE";
    el.flag.src = fallbackFlag;
    el.flag.alt = fallbackFlag ? "Flag of " + name : "";
    el.flag.style.visibility = fallbackFlag ? "visible" : "hidden";
    el.image.src = EARTH_TEXTURE;
    el.image.alt = "View of " + name;
    el.image.style.opacity = ".45";

    el.capital.textContent = "—";
    el.population.textContent = "—";
    el.language.textContent = "—";
    el.currency.textContent = "—";
    el.area.textContent = "—";
    el.timezone.textContent = "—";
    el.continent.textContent = safe(region);
    el.calling.textContent = "—";
    el.driving.textContent = "—";
    el.maps.href = "https://www.google.com/maps/search/" + encodeURIComponent(name);
    el.summary.textContent = "Loading country details…";
  }

  function applyCountryDetails(feature, country) {
    if (!country) return;

    const name = country?.name?.common || featureName(feature);
    const flag = country?.flags?.svg || country?.flags?.png || flagUrl(feature, 160);

    el.name.textContent = name;
    el.region.textContent = [country.region, country.subregion].filter(Boolean).join(" / ").toUpperCase() || "COUNTRY PROFILE";
    el.flag.src = flag;
    el.flag.alt = flag ? "Flag of " + name : "";
    el.flag.style.visibility = flag ? "visible" : "hidden";
    el.capital.textContent = country.capital?.[0] || "—";
    el.population.textContent = formatNumber(country.population);
    el.language.textContent = countryLanguages(country);
    el.currency.textContent = countryCurrency(country);
    el.area.textContent = formatArea(country.area);
    el.timezone.textContent = country.timezones?.[0] || "—";
    el.continent.textContent = country.continents?.[0] || country.region || featureRegion(feature) || "—";
    el.calling.textContent = callingCode(country);
    el.driving.textContent = country.car?.side
      ? country.car.side.charAt(0).toUpperCase() + country.car.side.slice(1)
      : "—";
    el.maps.href = country.maps?.googleMaps || "https://www.google.com/maps/search/" + encodeURIComponent(name);

    if (Array.isArray(country.latlng) && country.latlng.length >= 2) {
      const lat = Number(country.latlng[0]);
      const lng = Number(country.latlng[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        setCoordinates(lat, lng);
        try {
          state.globe?.pointOfView({ lat, lng, altitude: 1.65 }, 900);
        } catch (error) {
          console.warn("Camera update skipped:", error);
        }
      }
    }
  }

  async function showCountry(feature) {
    if (!feature) return;

    const token = ++state.selectionToken;
    state.selected = feature;
    state.hovered = null;

    try {
      if (state.globe?.controls) {
        const controls = state.globe.controls();
        if (controls) controls.autoRotate = false;
      }
    } catch (error) {
      console.warn("Auto-rotation could not be paused:", error);
    }

    refreshPolygons();

    const name = featureName(feature);
    const center = featureCenter(feature);

    el.panel.classList.add("open");
    el.panel.classList.remove("inactive");
    el.globeLabel.textContent = name.toUpperCase();
    setCoordinates(center.lat, center.lng);
    resetCountryFields(feature);

    try {
      state.globe?.pointOfView({ lat: center.lat, lng: center.lng, altitude: 1.72 }, 900);
    } catch (error) {
      console.warn("Country camera transition skipped:", error);
    }

    const [countryResult, wikiResult] = await Promise.allSettled([
      getCountryDetails(feature),
      getWikipediaProfile(name)
    ]);

    if (token !== state.selectionToken) return;

    const country = countryResult.status === "fulfilled" ? countryResult.value : null;
    const wiki = wikiResult.status === "fulfilled" ? wikiResult.value : { summary: "", image: "" };

    applyCountryDetails(feature, country);

    const displayName = country?.name?.common || name;
    el.summary.textContent =
      wiki.summary ||
      displayName + " is located in " + safe(country?.region || featureRegion(feature), "the world") +
      ". Core geographic information is available even when external profile services are unavailable.";

    const imageSource = wiki.image || country?.flags?.png || flagUrl(feature, 160) || EARTH_TEXTURE;
    el.image.src = imageSource;
    el.image.alt = "View of " + displayName;
    el.image.style.opacity = ".8";
  }

  function hideCountry() {
    ++state.selectionToken;
    el.panel.classList.remove("open");
    el.panel.classList.add("inactive");
    state.selected = null;
    el.globeLabel.textContent = "EARTH";
    refreshPolygons();
  }

  function searchFeatures(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    return state.features
      .filter((feature) => {
        const name = featureName(feature).toLowerCase();
        const code3 = featureCode(feature).toLowerCase();
        const code2 = featureCode2(feature).toLowerCase();
        return name.includes(q) || code3 === q || code2 === q;
      })
      .sort((a, b) => {
        const an = featureName(a).toLowerCase();
        const bn = featureName(b).toLowerCase();
        const ae = an === q ? -1 : an.startsWith(q) ? 0 : 1;
        const be = bn === q ? -1 : bn.startsWith(q) ? 0 : 1;
        return ae - be || an.localeCompare(bn);
      })
      .slice(0, 8);
  }

  function renderSearchResults(query) {
    const matches = searchFeatures(query);
    el.results.innerHTML = "";

    if (!query.trim() || !matches.length) {
      el.results.hidden = true;
      return;
    }

    matches.forEach((feature) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";

      const image = document.createElement("img");
      const flag = flagUrl(feature, 80);
      image.alt = "";
      image.src = flag || EARTH_TEXTURE;

      const text = document.createElement("span");
      const title = document.createElement("strong");
      const subtitle = document.createElement("small");

      title.textContent = featureName(feature);
      subtitle.textContent = [featureRegion(feature), featureCode(feature)].filter(Boolean).join(" · ");

      text.append(title, subtitle);
      button.append(image, text);

      button.addEventListener("click", () => {
        el.search.value = featureName(feature);
        el.results.hidden = true;
        showCountry(feature);
      });

      el.results.appendChild(button);
    });

    el.results.hidden = false;
  }

  function renderQuickCountries() {
    el.quick.innerHTML = "";

    quickDestinations.forEach((item) => {
      const feature = state.featureByCode.get(item.code);
      if (!feature) return;

      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-country";

      const image = document.createElement("img");
      image.alt = "";
      image.src = flagUrl(feature, 80) || EARTH_TEXTURE;

      const label = document.createElement("span");
      label.textContent = item.name;

      button.append(image, label);
      button.addEventListener("click", () => showCountry(feature));
      el.quick.appendChild(button);
    });
  }

  function resetView() {
    hideCountry();
    state.hovered = null;
    refreshPolygons();
    setCoordinates(20, 0);

    try {
      state.globe?.pointOfView({ lat: 20, lng: 0, altitude: 2.25 }, 900);
      const controls = state.globe?.controls?.();
      if (controls) controls.autoRotate = true;
    } catch (error) {
      console.warn("Reset view skipped:", error);
    }
  }

  function randomCountry() {
    if (!state.features.length) return;
    const feature = state.features[Math.floor(Math.random() * state.features.length)];
    showCountry(feature);
  }

  function initGlobe() {
    try {
      state.globe = new Globe(el.globe);
    } catch (_) {
      state.globe = Globe()(el.globe);
    }

    state.globe
      .backgroundColor("rgba(0,0,0,0)")
      .globeImageUrl(EARTH_TEXTURE)
      .bumpImageUrl(EARTH_BUMP)
      .showAtmosphere(true)
      .atmosphereColor("#6aa4ff")
      .atmosphereAltitude(0.18)
      .polygonCapColor(getCountryColor)
      .polygonSideColor(() => "rgba(31,63,114,0.14)")
      .polygonStrokeColor(() => "rgba(133,197,255,0.32)")
      .polygonAltitude(getCountryAltitude)
      .polygonLabel((feature) => {
        const name = featureName(feature);
        const region = featureRegion(feature) || "Select to explore";
        return '<div style="padding:8px 10px;border-radius:10px;background:rgba(4,9,22,.88);border:1px solid rgba(255,255,255,.14);font-family:Inter,sans-serif">' +
          '<div style="font-size:12px;font-weight:700;color:#fff">' + name + '</div>' +
          '<div style="margin-top:3px;font-size:9px;color:#8da0bd">' + region + '</div></div>';
      })
      .onPolygonHover((feature) => {
        state.hovered = feature || null;
        if (el.globe) el.globe.style.cursor = feature ? "pointer" : "grab";
        refreshPolygons();
      })
      .onPolygonClick((feature) => showCountry(feature))
      .onGlobeClick(({ lat, lng }) => setCoordinates(lat, lng))
      .polygonsTransitionDuration(220);

    const controls = state.globe.controls();
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.32;
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 120;
    controls.maxDistance = 420;

    state.globe.pointOfView({ lat: 20, lng: 0, altitude: 2.25 }, 0);

    const resize = () => {
      const rect = el.globe.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        state.globe.width(rect.width).height(rect.height);
      }
    };

    if ("ResizeObserver" in window) {
      new ResizeObserver(resize).observe(el.globe);
    } else {
      window.addEventListener("resize", resize);
    }
    resize();
  }

  async function loadWorld() {
    try {
      initGlobe();

      const geoResponse = await fetchJson(GEO_URL, 12000);
      state.features = Array.isArray(geoResponse?.features) ? geoResponse.features : [];

      if (!state.features.length) throw new Error("Country geometry dataset is empty");

      state.featureByCode.clear();
      state.features.forEach((feature) => {
        const code = featureCode(feature);
        if (code && code !== "-99") state.featureByCode.set(code, feature);
      });

      state.globe.polygonsData(state.features);
      state.ready = true;

      renderQuickCountries();
      el.count.textContent = state.features.length + " geographic regions connected";
      el.loading.style.display = "none";
      el.image.src = EARTH_TEXTURE;
      el.image.alt = "Planet Earth";
      refreshPolygons();

      if (window.lucide) window.lucide.createIcons();
    } catch (error) {
      console.error("World Explorer failed to initialize:", error);
      el.loading.style.display = "none";
      el.error.hidden = false;
    }
  }

  el.search.addEventListener("input", (event) => renderSearchResults(event.target.value));

  el.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = searchFeatures(el.search.value)[0];
      if (first) {
        el.search.value = featureName(first);
        el.results.hidden = true;
        showCountry(first);
      }
    }

    if (event.key === "Escape") {
      el.results.hidden = true;
      el.search.blur();
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".global-search")) el.results.hidden = true;
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      el.search.focus();
      el.search.select();
    }
    if (event.key === "Escape") hideCountry();
  });

  el.random.addEventListener("click", randomCountry);
  el.reset.addEventListener("click", resetView);
  el.close.addEventListener("click", hideCountry);

  if (window.lucide) window.lucide.createIcons();
  loadWorld();
})();
