# World Explorer 🌍

A premium interactive 3D world-discovery experience built for the web.

**Live site:** https://saaeiddev.github.io/World-Explorer-/

## Experience

World Explorer turns global discovery into an immersive spatial interface. A high-fidelity WebGL globe sits at the center of the experience, surrounded by a futuristic Liquid Glass interface. Users can rotate and zoom the planet, hover over national borders, select countries, search destinations, and open live country profiles.

## Highlights

- Interactive 3D Earth with cinematic atmosphere and realistic surface texture
- Country borders with hover, highlight, and click interactions
- Smooth camera travel to selected countries
- Live country data: capital, population, languages, currencies, area, timezone, continent, calling code, and driving side
- Wikipedia-powered country summaries and imagery
- Global search with keyboard shortcut
- Popular-destination quick navigation and random-country discovery
- Premium dark Liquid Glass / glassmorphism visual system
- Responsive desktop, tablet, and mobile layouts
- GitHub Pages-ready static architecture — no build step required

## Technology

- Globe.gl / Three.js / WebGL
- Natural Earth country geometry
- REST Countries API
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
