# World Explorer 🌍

A premium interactive 3D world-discovery experience built for the web.

**Live site:** https://saaeiddev.github.io/World-Explorer-/

## Experience

World Explorer turns global discovery into an immersive spatial interface. A high-fidelity WebGL globe sits at the center of the experience, surrounded by a futuristic Liquid Glass interface. Users can rotate and zoom the planet, hover over national borders, select countries, search destinations, and open live country profiles.

## Highlights

- Interactive 3D Earth with cinematic atmosphere and realistic surface texture
- Country borders with hover, highlight, and click interactions
- Smooth camera travel to selected countries
- Live country data: capital, current population, languages, currencies, area, region, calling code, country status, and ISO code
- Wikipedia-powered country summaries and imagery
- Playable national anthem audio where an open recording is available
- Global search with keyboard shortcut
- Popular-destination quick navigation and random-country discovery
- Premium dark Liquid Glass / glassmorphism visual system
- Responsive desktop, tablet, and mobile layouts
- GitHub Pages-ready static architecture — no build step required

## Technology

- Globe.gl / Three.js / WebGL
- Natural Earth country geometry
- World Bank Indicators API (population)
- mledoze/countries open country dataset
- Open Assets Hub national-anthems dataset
- Wikipedia REST API
- Lucide Icons
- HTML5, CSS3, vanilla JavaScript

## Run locally

Because the project fetches remote geographic data, serve it with a small local web server instead of opening the HTML file directly.

```bash
python3 -m http.server 8080
```

Then open:

```
http://localhost:8080
```

## Controls

- Drag — rotate Earth
- Scroll / pinch — zoom
- Hover — highlight borders
- Click — open a country profile
- Cmd/Ctrl + K — focus country search
- Esc — close country profile

## Author

Created by **Amir Saeid Dehghan**.
