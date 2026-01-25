# Skateshop Finder

A free, static website that helps users find nearby skateboard shops in the United States.

## Running Locally

The site requires a local HTTP server because:
- The Geolocation API requires a secure context (HTTPS or localhost)
- Loading `shops.json` requires serving files over HTTP

### Option 1: Python (recommended)

Python 3:
```bash
python3 -m http.server 8000
```

Python 2:
```bash
python -m SimpleHTTPServer 8000
```

Then open http://localhost:8000

### Option 2: Node.js

Install a simple server globally:
```bash
npm install -g http-server
```

Run it:
```bash
http-server -p 8000
```

Then open http://localhost:8000

### Option 3: VS Code Live Server

1. Install the "Live Server" extension in VS Code
2. Right-click `index.html` and select "Open with Live Server"

## Project Structure

```
├── index.html          # Main HTML page
├── app.js              # Application logic (geolocation, distance calc, search)
├── styles.css          # Styling
├── shops.json          # Skateshop database
├── scripts/
│   ├── collect-shops.js        # Main data collection script
│   ├── validate-data.js        # Data quality validation
│   ├── sources/
│   │   ├── overpass.js         # OpenStreetMap API integration
│   │   └── chains.js           # Chain store data loader
│   ├── processors/
│   │   ├── deduplicator.js     # Remove duplicate entries
│   │   ├── classifier.js       # Independent vs chain detection
│   │   ├── normalizer.js       # Data formatting
│   │   └── geocoder.js         # Coordinate validation
│   ├── data/
│   │   ├── chain-stores.json   # Curated chain locations
│   │   └── manual-additions.json # Community submissions
│   ├── utils/
│   │   └── rate-limiter.js     # API rate limiting
│   └── tests/                  # Unit tests
└── README.md
```

## Data Collection

The `scripts/` directory contains Node.js tools for collecting and processing skateshop data.

### Setup

```bash
npm install
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run collect` | Fetch shops from all sources and generate `shops.json` |
| `npm run validate` | Check data quality (required fields, coordinates, formats) |
| `npm test` | Run unit tests (81 tests) |

### Data Sources

1. **OpenStreetMap** (Primary) - Queries the Overpass API for shops tagged as `shop=skate` or `shop=sports` with skateboard tags within the USA bounding box.

2. **Chain Stores** - Loads curated data from `scripts/data/chain-stores.json` (currently empty, to be expanded with Zumiez, Vans, etc.).

3. **Manual Additions** - Community-submitted shops from `scripts/data/manual-additions.json`.

### Processing Pipeline

1. **Collect** - Fetch data from all sources in parallel
2. **Deduplicate** - Remove duplicates by coordinates (~11m threshold) or name+city
3. **Validate** - Filter to USA bounds, check coordinate validity
4. **Classify** - Detect chain stores (Zumiez, Vans, Tactics, CCS, Tilly's, PacSun)
5. **Normalize** - Clean names, format phones as `(XXX) XXX-XXXX`, prefix URLs with `https://`
6. **Output** - Write sorted results to `shops.json`

### Adding Shops Manually

To add shops that aren't in OpenStreetMap:

1. Edit `scripts/data/manual-additions.json`:
```json
[
  {
    "name": "Shop Name",
    "address": "123 Main St, City, ST 12345",
    "lat": 34.0522,
    "lng": -118.2437,
    "website": "https://example.com",
    "phone": "555-123-4567",
    "isIndependent": true
  }
]
```

2. Run `npm run collect` to regenerate `shops.json`

## License

GPL-3.0
