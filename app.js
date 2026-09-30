(() => {
  "use strict";

  const GEO_URL = "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson";
  const COUNTRIES_URL = "https://restcountries.com/v3.1/all?fields=name,cca3,capital,region,subregion,population,languages,currencies,area,timezones,latlng,flags,idd,car,maps,continents";
  const EARTH_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg";
  const EARTH_BUMP = "https://unpkg.com/three-globe/example/img/earth-topology.png";

  const state = {
    globe: null,
    countries: [],
    countryByCode: new Map(),
    features: [],
    hovered: null,
    selected: null,
    autoRotate: true,
    ready: false
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

  const aliases = new Map([
    ["United States of America", "United States"],
    ["The Bahamas", "Bahamas"],
    ["Czechia", "Czechia"],
    ["Democratic Republic of the Congo", "DR Congo"],
    ["Republic of the Congo", "Republic of the Congo"],
    ["Ivory Coast", "Côte d'Ivoire"],
    ["South Korea", "South Korea"],
    ["North Korea", "North Korea"],
    ["East Timor", "Timor-Leste"],
    ["Swaziland", "Eswatini"],
    ["Cape Verde", "Cabo Verde"]
  ]);

  const safe = (value, fallback = "—") => {
    if (value === undefined || value === null || value === "") return fallback;
    return value;
  };

  const formatNumber = (value) => {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  };

  const formatArea = (value) => {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value) + " km²";
  };

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

  function findCountryForFeature(feature) {
    const code = featureCode(feature);
    if (code && code !== "-99" && state.countryByCode.has(code)) {
      return state.countryByCode.get(code);
    }

    const rawName = featureName(feature);
    const targetName = aliases.get(rawName) || rawName;
    const normalized = targetName.toLowerCase();

    return state.countries.find((country) => {
      const common = country?.name?.common?.toLowerCase();
      const official = country?.name?.official?.toLowerCase();
      return common === normalized || official === normalized;
    });
  }

  function setCoordinates(lat, lng) {
    const latAbs = Math.abs(lat).toFixed(1);
    const lngAbs = Math.abs(lng).toFixed(1);
    el.lat.textContent = latAbs + "° " + (lat >= 0 ? "N" : "S");
    el.lng.textContent = lngAbs + "° " + (lng >= 0 ? "E" : "W");
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
    state.globe
      .polygonCapColor(getCountryColor)
      .polygonAltitude(getCountryAltitude);
  }

  async function getWikipediaProfile(countryName) {
    try {
      const title = encodeURIComponent(countryName.replaceAll(" ", "_"));
      const response = await fetch("https://en.wikipedia.org/api/rest_v1/page/summary/" + title);
      if (!response.ok) throw new Error("Wikipedia summary unavailable");
      const data = await response.json();
      return {
        summary: data.extract || "",
        image: data.originalimage?.source || data.thumbnail?.source || ""
      };
    } catch (_) {
      return { summary: "", image: "" };
    }
  }

  function countryCurrency(country) {
    const currencies = Object.values(country?.currencies || {});
    if (!currencies.length) return "—";
    return currencies
      .slice(0, 2)
      .map((item) => item.symbol ? item.name + " (" + item.symbol + ")" : item.name)
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

  async function showCountry(feature, country) {
    if (!country) return;

    state.selected = feature || state.features.find((item) => findCountryForFeature(item)?.cca3 === country.cca3) || null;
    state.autoRotate = false;
    if (state.globe?.controls()) state.globe.controls().autoRotate = false;
    refreshPolygons();

    const name = country.name?.common || featureName(feature);
    const lat = country.latlng?.[0] ?? 20;
    const lng = country.latlng?.[1] ?? 0;

    el.panel.classList.add("open");
    el.panel.classList.remove("inactive");
    el.globeLabel.textContent = name.toUpperCase();
    setCoordinates(lat, lng);

    el.name.textContent = name;
    el.region.textContent = [country.region, country.subregion].filter(Boolean).join(" / ").toUpperCase();
    el.flag.src = country.flags?.svg || country.flags?.png || "";
    el.flag.alt = "Flag of " + name;
    el.image.alt = "View of " + name;
    el.capital.textContent = country.capital?.[0] || "—";
    el.population.textContent = formatNumber(country.population);
    el.language.textContent = countryLanguages(country);
    el.currency.textContent = countryCurrency(country);
    el.area.textContent = formatArea(country.area);
    el.timezone.textContent = country.timezones?.[0] || "—";
    el.continent.textContent = country.continents?.[0] || country.region || "—";
    el.calling.textContent = callingCode(country);
    el.driving.textContent = country.car?.side ? country.car.side.charAt(0).toUpperCase() + country.car.side.slice(1) : "—";
    el.maps.href = country.maps?.googleMaps || "https://www.google.com/maps/search/" + encodeURIComponent(name);

    el.summary.textContent = "Loading a concise country profile...";
    el.image.style.opacity = ".45";

    state.globe?.pointOfView({ lat, lng, altitude: 1.65 }, 1200);

    const wiki = await getWikipediaProfile(name);
    if (state.selected && country.cca3 !== findCountryForFeature(state.selected)?.cca3) return;

    el.summary.textContent = wiki.summary || (name + " is located in " + safe(country.region, "the world") + ". Explore its key geographic and cultural facts through the live profile below.");
    el.image.src = wiki.image || country.flags?.png || EARTH_TEXTURE;
    el.image.style.opacity = ".8";
  }

  function hideCountry() {
    el.panel.classList.remove("open");
    el.panel.classList.add("inactive");
    state.selected = null;
    el.globeLabel.textContent = "EARTH";
    refreshPolygons();
  }

  function searchCountries(query) {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return state.countries
      .filter((country) => {
        const common = country.name?.common?.toLowerCase() || "";
        const official = country.name?.official?.toLowerCase() || "";
        const capital = country.capital?.join(" ").toLowerCase() || "";
        return common.includes(q) || official.includes(q) || capital.includes(q) || country.cca3?.toLowerCase() === q;
      })
      .sort((a, b) => {
        const an = a.name?.common?.toLowerCase() || "";
        const bn = b.name?.common?.toLowerCase() || "";
        const ae = an === q ? -1 : an.startsWith(q) ? 0 : 1;
        const be = bn === q ? -1 : bn.startsWith(q) ? 0 : 1;
        return ae - be || an.localeCompare(bn);
      })
      .slice(0, 7);
  }

  function renderSearchResults(query) {
    const matches = searchCountries(query);
    el.results.innerHTML = "";

    if (!query.trim() || !matches.length) {
      el.results.hidden = true;
      return;
    }

    matches.forEach((country) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.innerHTML =
        '<img alt="" src="' + (country.flags?.svg || country.flags?.png || "") + '">' +
        '<span><strong>' + country.name.common + '</strong><small>' +
        [country.region, country.capital?.[0]].filter(Boolean).join(" · ") +
        "</small></span>";
      button.addEventListener("click", () => {
        const feature = state.features.find((item) => findCountryForFeature(item)?.cca3 === country.cca3);
        showCountry(feature, country);
        el.search.value = country.name.common;
        el.results.hidden = true;
      });
      el.results.appendChild(button);
    });

    el.results.hidden = false;
  }

  function renderQuickCountries() {
    const codes = ["JPN", "USA", "FRA", "ITA", "CAN", "KOR"];
    el.quick.innerHTML = "";

    codes.forEach((code) => {
      const country = state.countryByCode.get(code);
      if (!country) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-country";
      button.innerHTML =
        '<img alt="" src="' + (country.flags?.svg || country.flags?.png || "") + '">' +
        "<span>" + country.name.common + "</span>";
      button.addEventListener("click", () => {
        const feature = state.features.find((item) => findCountryForFeature(item)?.cca3 === code);
        showCountry(feature, country);
      });
      el.quick.appendChild(button);
    });
  }

  function resetView() {
    hideCountry();
    state.hovered = null;
    state.autoRotate = true;
    refreshPolygons();
    if (state.globe) {
      state.globe.pointOfView({ lat: 20, lng: 0, altitude: 2.25 }, 1000);
      if (state.globe.controls()) state.globe.controls().autoRotate = true;
    }
    setCoordinates(20, 0);
  }

  function randomCountry() {
    if (!state.countries.length) return;
    const candidates = state.countries.filter((country) => Array.isArray(country.latlng) && country.latlng.length === 2);
    const country = candidates[Math.floor(Math.random() * candidates.length)];
    const feature = state.features.find((item) => findCountryForFeature(item)?.cca3 === country.cca3);
    showCountry(feature, country);
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
        const country = findCountryForFeature(feature);
        const name = country?.name?.common || featureName(feature);
        const capital = country?.capital?.[0] || "Select to explore";
        return '<div style="padding:8px 10px;border-radius:10px;background:rgba(4,9,22,.88);border:1px solid rgba(255,255,255,.14);font-family:Inter,sans-serif">' +
          '<div style="font-size:12px;font-weight:700;color:#fff">' + name + '</div>' +
          '<div style="margin-top:3px;font-size:9px;color:#8da0bd">' + capital + '</div></div>';
      })
      .onPolygonHover((feature) => {
        state.hovered = feature || null;
        if (el.globe) el.globe.style.cursor = feature ? "pointer" : "grab";
        refreshPolygons();
      })
      .onPolygonClick((feature) => {
        const country = findCountryForFeature(feature);
        if (country) showCountry(feature, country);
      })
      .onGlobeClick(({ lat, lng }) => {
        setCoordinates(lat, lng);
      })
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

    new ResizeObserver(resize).observe(el.globe);
    resize();
  }

  async function loadWorld() {
    try {
      initGlobe();

      const [geoResponse, countriesResponse] = await Promise.all([
        fetch(GEO_URL),
        fetch(COUNTRIES_URL)
      ]);

      if (!geoResponse.ok || !countriesResponse.ok) throw new Error("Global datasets unavailable");

      const [geoData, countryData] = await Promise.all([
        geoResponse.json(),
        countriesResponse.json()
      ]);

      state.countries = countryData.sort((a, b) => (a.name?.common || "").localeCompare(b.name?.common || ""));
      state.countryByCode = new Map(state.countries.map((country) => [country.cca3, country]));
      state.features = geoData.features || [];
      state.globe.polygonsData(state.features);
      state.ready = true;

      renderQuickCountries();
      el.count.textContent = state.countries.length + " countries connected";
      el.loading.style.display = "none";
      refreshPolygons();

      el.image.src = EARTH_TEXTURE;
      el.image.alt = "Planet Earth";

      window.setTimeout(() => {
        if (window.lucide) window.lucide.createIcons();
      }, 0);
    } catch (error) {
      console.error("World Explorer failed to initialize:", error);
      el.loading.style.display = "none";
      el.error.hidden = false;
    }
  }

  el.search.addEventListener("input", (event) => renderSearchResults(event.target.value));
  el.search.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const first = searchCountries(el.search.value)[0];
      if (first) {
        const feature = state.features.find((item) => findCountryForFeature(item)?.cca3 === first.cca3);
        showCountry(feature, first);
        el.results.hidden = true;
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
