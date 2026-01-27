# Skateshop Finder

A free, static [website](https://skateindex.com) that helps users find nearby skateboard shops.

Limited to shops within the United States for now.

## Features

### Search Options
- **Address Search**: Enter a city, state, or ZIP code to find nearby shops
- **Geolocation**: Use your current location to find shops near you

### View Modes
- **List View** (default): Shows shops as cards with name, address, distance, and contact info
- **Map View**: Interactive map powered by Leaflet.js and OpenStreetMap

### Map Features
- **Pink markers**: Chain store locations (Zumiez, Vans, etc.)
- **Green markers**: Independent skate shops
- **Blue marker**: Your current location
- Click any marker to see shop details and get directions via Google Maps

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
├── app.js              # Application logic (geolocation, search, display)
├── app.utils.js        # Pure utility functions (distance calc, filtering, HTML generation)
├── analytics.js        # Google Analytics 4 abstraction layer
├── privacy.html        # Privacy policy page
├── styles.css          # Styling
├── shops.json          # Skateshop database
├── tests/
│   ├── app.utils.test.js       # Frontend unit tests (91 tests)
│   └── analytics.test.js       # Analytics unit tests
├── scripts/
│   ├── collect-shops.js        # Main data collection script
│   ├── review-shops.js         # Interactive CLI for manual review
│   ├── validate-data.js        # Data quality validation
│   ├── sources/
│   │   ├── google-places.js    # Google Places API integration (primary)
│   │   ├── overpass.js         # OpenStreetMap API (deprecated)
│   │   └── manual.js           # Manual additions loader
│   ├── processors/
│   │   ├── deduplicator.js     # Remove duplicate entries
│   │   ├── classifier.js       # Confidence scoring & chain detection
│   │   ├── normalizer.js       # Data formatting
│   │   └── geocoder.js         # Coordinate validation
│   ├── data/
│   │   ├── manual-additions.json  # Community submissions
│   │   ├── approved-shops.json    # Manually approved shop IDs
│   │   ├── removed-shops.json     # Manually rejected shop IDs
│   │   └── pending-review.json    # Shops awaiting manual review
│   ├── utils/
│   │   └── rate-limiter.js     # API rate limiting
│   └── tests/                  # Data collection unit tests
└── README.md
```

## Data Collection

The `scripts/` directory contains Node.js tools for collecting and processing skateshop data.

### Setup

```bash
npm install
```

### Google Places API Key

The primary data source requires a Google Places API key:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable "Places API (New)" under APIs & Services
4. Create an API key under Credentials
5. Set the environment variable:

```bash
export GOOGLE_PLACES_API_KEY=your_key_here
```

**Cost:** Free tier includes 5,000 Text Search requests/month. Our collection uses ~220-660 requests (with pagination), so quarterly updates cost $0.

### Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Builds the website for deployment |
| `npm run collect` | Fetch shops from all sources and generate `shops.json` |
| `npm run review` | Interactive CLI to approve/deny pending shops |
| `npm run collect:google` | Run Google Places collection standalone |
| `npm run collect:google:dry-run` | Preview Google Places search (no API key needed) |
| `npm run validate` | Check data quality (required fields, coordinates, formats) |
| `npm test` | Run all unit tests |
| `npm run test:frontend` | Run frontend tests only |
| `npm run test:scripts` | Run data collection tests only |

### Data Sources

1. **Google Places API** (Primary) - Searches for "skateboard shop" across 220+ US metro areas using the Text Search API with pagination (up to 60 results per metro). Returns both independent and chain stores. Requires `GOOGLE_PLACES_API_KEY` environment variable. Free tier: 5,000 requests/month (we use ~220-660).

2. **Manual Additions** - Community-submitted shops from `scripts/data/manual-additions.json`.

4. ~~**OpenStreetMap**~~ (Deprecated) - Previously used the Overpass API, but data quality was poor (stale listings, missing shops, inconsistent tagging).

### Processing Pipeline

1. **Collect** - Fetch data from all sources in parallel
2. **Deduplicate** - Remove duplicates by coordinates (~11m threshold) or name+city
3. **Validate** - Filter to USA bounds, check coordinate validity
4. **Classify** - Detect chain stores (Zumiez, Vans, Tactics, CCS, Tilly's, PacSun)
5. **Normalize** - Clean names, format phones as `(XXX) XXX-XXXX`, prefix URLs with `https://`
6. **Confidence Filter** - Score shops and route to appropriate output (see below)
7. **Output** - Write high-confidence shops to `shops.json`, uncertain shops to `pending-review.json`

### Confidence-Based Filtering

Shops are scored based on how likely they are to be legitimate skateboard shops:

| Confidence | Criteria | Action |
|------------|----------|--------|
| **Highest** | Known chain (Zumiez, etc.) or `skateboard_shop` type | Auto-include |
| **Very High** | Skate park with store type | Auto-include |
| **Good** | Store type + skate-related name or website | Auto-include |
| **Review** | Store type but no clear skateboard indicator | Pending review |
| **Exclude** | Matches skip patterns (ice skate, hockey, etc.) or no store type | Dropped |

Skate-related patterns checked in name and website: `skate`, `sk8`, `board`, `deck`, `shred`, `thrash`

### Manual Review Workflow

After running `npm run collect`, uncertain shops are written to `pending-review.json`. Use the interactive review CLI:

```bash
npm run review
```

For each shop, you can:
- **(A)pprove** - Add to `shops.json` and `approved-shops.json`
- **(D)eny** - Add to `removed-shops.json` (won't appear again)
- **(S)kip** - Leave in pending review for later
- **(Q)uit** - Save progress and exit

Previously approved/removed shops are remembered across collection runs.

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

## User Feedback

The site includes two forms for user feedback:

### Suggest a Shop

Users can suggest shops that are missing from the database. The form collects:
- Shop name (required)
- Address (required)
- Website (optional)
- Phone (optional)
- Shop type: Independent or Chain (required)
- Submitter email (optional, for follow-up)

### Report a Closed Shop

Users can report shops that have closed. The form includes:
- Shop selector with search functionality
- Comments field (optional)
- Submitter email (optional, for follow-up)

### Form Backend Setup

Forms are configured to use [Formspree](https://formspree.io/) for submission handling.
Formspree free tier includes 50 submissions per month, which should be sufficient for community feedback.

## Analytics

The site uses Google Analytics 4 (GA4) for privacy-focused usage tracking.

### Events Tracked

| Event | Trigger | Parameters |
|-------|---------|------------|
| `search` | User searches for shops | `method`, `result_count`, `has_results` |
| `geolocation` | Successful geolocation | `success: true` |
| `geolocation_error` | Geolocation fails | `error_type` |
| `view_results` | Results displayed | `result_count`, `nearest_distance` |
| `view_change` | List/map toggle | `view` |
| `shop_click` | Click shop link | `shop_name`, `is_independent`, `action` |
| `form_open` | Modal opened | `form_type` |
| `form_submit` | Form submitted | `form_type` |
| `error` | Error occurs | `error_type`, `error_message` |

### Privacy Features

- No personally identifiable information (PII) is tracked
- IP anonymization is enabled
- Search queries and addresses are never sent to analytics
- Geolocation data stays in the browser
- All tracking gracefully degrades if blocked by ad blockers

See [privacy.html](privacy.html) for the full privacy policy.

## License

GPL-3.0
