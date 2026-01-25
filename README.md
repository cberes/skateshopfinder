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
├── index.html      # Main HTML page
├── app.js          # Application logic (geolocation, distance calc, search)
├── styles.css      # Styling
├── shops.json      # Skateshop database
└── README.md       # This file
```

## License

GPL-3.0
