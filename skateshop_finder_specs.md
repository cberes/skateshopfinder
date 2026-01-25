# USA Skateshop Finder - Project Specifications

## Project Overview
A free, static website that helps users find nearby skateboard shops in the United States by entering their address or using browser geolocation.

## Core Requirements

### Functionality
- **Location Input**
  - Text field for address entry
  - Browser geolocation button ("Use my location")
- **Results Display**
  - Shop name
  - Full address
  - Distance from user (in miles)
  - Website link (if available)
  - Phone number (optional)
- **Sorting & Filtering**
  - Results sorted by distance (nearest first)
  - Limit to 20 results OR 100-mile radius (whichever is more restrictive)
- **Geographic Scope**
  - USA only (initial version)

### Technical Constraints
- Fully static website (no backend server)
- Client-side JavaScript for all calculations
- No ongoing API costs
- Zero or minimal hosting costs

## Architecture

### Approach
Static website with pre-compiled skateshop database, updated quarterly through manual/semi-automated process.

### Data Storage
- Single JSON file containing all US skateshop data
- Served as static asset with the website
- Current size: ~46KB (191 shops from OSM)
- Estimated size after chain data: 200-400KB (1,000-1,500 shops)

### Hosting
- **Primary option:** GitHub Pages (free)
- **Alternatives:** Netlify, Vercel, Cloudflare Pages
- **Domain:** Optional custom domain ($10-15/year)

## Data Structure

### Shop Data Format
```json
{
  "shops": [
    {
      "id": 1,
      "name": "Local Skate Shop",
      "address": "123 Main St, City, State ZIP",
      "lat": 34.0522,
      "lng": -118.2437,
      "isIndependent": true,
      "website": "https://example.com",
      "phone": "(555) 123-4567"
    }
  ],
  "lastUpdated": "2026-01-25",
  "version": "1.0",
  "stats": {
    "total": 191,
    "independent": 188,
    "chain": 3,
    "withWebsite": 116,
    "withPhone": 100
  }
}
```

### Field Definitions
- **id**: Unique identifier (integer, sequential)
- **name**: Shop name (string, required)
- **address**: Full street address including city, state, ZIP (string, optional - 81% coverage)
- **lat**: Latitude (float, required, 6 decimal places)
- **lng**: Longitude (float, required, 6 decimal places)
- **isIndependent**: Boolean flag - true for independent shops, false for chains (boolean, required)
- **website**: Shop website URL with https:// prefix (string, optional - 61% coverage)
- **phone**: Contact phone number in (XXX) XXX-XXXX format (string, optional - 52% coverage)

## Data Collection Strategy

### Initial Database Compilation

**Data Sources:**
1. ~~Overpass API query of OpenStreetMap~~ - *deprecated due to poor data quality (see below)*
2. **Google Places API** (Text Search) - primary source for shop discovery
3. Chain store data file (curated Zumiez/Vans/Tactics locations) - *to be expanded*
4. Manual additions file for community submissions

**Why Not OpenStreetMap:**
Testing revealed significant issues with OSM data:
- Closed/moved shops still in database (stale data)
- Many shops missing entirely (e.g., established local shops not present)
- Inconsistent tagging (skateshops tagged as `shop=clothes` instead of `shop=skate`)
- Includes non-USA shops, shops without complete addresses
- False positives (fingerboard shops, general sporting goods)

**Google Places API Strategy:**
- Use Text Search API to find "skate shop" across US metro areas
- Free tier: 5,000 requests/month (sufficient for nationwide coverage)
- Estimated requests per collection: ~1,500 (well within free tier)
- Cost: **$0** if staying under 5,000 requests/month

**Implemented Scripts** (`scripts/` directory):
```
scripts/
├── collect-shops.js          # Main orchestration (npm run collect)
├── validate-data.js          # Data quality checks (npm run validate)
├── sources/
│   ├── google-places.js      # Google Places API integration (primary)
│   ├── overpass.js           # OSM Overpass API (deprecated, poor quality)
│   └── chains.js             # Chain/manual data loader
├── processors/
│   ├── deduplicator.js       # Remove duplicates (~11m threshold)
│   ├── geocoder.js           # Validate/fill coordinates
│   ├── normalizer.js         # Clean and format data
│   └── classifier.js         # Independent vs chain detection
├── data/
│   ├── chain-stores.json     # Curated chain locations (empty, future use)
│   └── manual-additions.json # Community submissions (empty, future use)
├── utils/
│   └── rate-limiter.js       # API rate limiting
└── tests/
    └── *.test.js             # 81 unit tests (npm test)
```

**Current Status (2026-01-25):**
- ✅ Google Places API integration complete (`scripts/sources/google-places.js`)
- 220+ US metro areas covered, ~220 API requests per collection (within free tier)
- OSM data deprecated due to quality issues
- **Next step:** Run collection with Google Places API key to generate new dataset
- Chain store data (600+ Zumiez locations) to be added after initial Google Places collection

**Process:**
1. Run `npm run collect` - fetches from all sources
2. Automatic deduplication (coordinate + name matching)
3. Automatic classification (independent vs chain)
4. Automatic normalization (phone format, URLs, coordinates)
5. Run `npm run validate` - verify data quality
6. Manual review of results

### Data Maintenance
- **Update frequency:** Quarterly (every 3-4 months)
- **Update process:** Re-run collection script, merge with community submissions
- **Version control:** Track changes in git repository

## Technical Stack

### Frontend
- **Core:** HTML5, CSS3, Vanilla JavaScript
- **Distance calculation:** Haversine formula implementation (no external dependencies)
- **Optional enhancements:**
  - Leaflet.js for interactive map display
  - Simple CSS framework (optional)

### Development Tools
- **Data collection:** Node.js scripts with npm commands:
  - `npm run collect` - Fetch and process shop data from all sources
  - `npm run validate` - Check data quality (required fields, coordinates, formats)
  - `npm test` - Run unit tests (161 tests covering all processors)
- **Dependencies:** `node-fetch` (API calls), `node-geocoder` (coordinate validation)
- **Version control:** Git + GitHub
- **Deployment:** Automated via GitHub Actions (optional)

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile responsive design
- Geolocation API support

## Feature Specification

### MVP Features (Must Have)

#### Location Input
- [x] Text input field for address entry
- [x] "Use my location" button using Geolocation API
- [x] Input validation and error handling
- [x] Loading indicator during search

#### Results Display
- [x] List view of skateshops
- [x] Display: name, address, distance, website link (if available)
- [x] Badge for independent shops (prominent but not distracting)
- [x] Sorted by distance (nearest first)
- [x] Show only shops within 100 miles
- [x] Limit to maximum 20 results
- [x] "No results found" state when no shops match criteria

#### Distance Calculation
- [x] Client-side Haversine formula implementation
- [x] Display distance in miles with 1 decimal precision
- [x] Handle edge cases (empty results, invalid coordinates)

#### User Feedback Forms
- [ ] "Suggest a shop" feature
  - Form fields: shop name, address, website (optional), phone (optional), independent vs chain
  - Submitter email for follow-up (optional)
  - Form submission via Formspree or Google Forms
- [ ] "Report a closed shop" feature
  - Dropdown/search to select shop from database
  - Optional comment field
  - Submitter email (optional)
  - Form submission via Formspree or Google Forms

### Nice to Have Features (Phase 2)

#### Enhanced Display
- [ ] Interactive map view showing shop locations
- [ ] Toggle between list and map view
- [ ] Filter toggle: "Show independent shops only"
- [ ] "Get directions" link (opens Google/Apple Maps with destination)

#### User Experience
- [ ] Recent searches (stored in localStorage)
- [ ] Shareable URLs with encoded location
- [ ] Print-friendly results page
- [ ] Dark mode toggle

#### Information Display
- [ ] Photo of storefront (if available)
- [ ] Enhanced independent shop highlighting

### Explicitly Excluded Features
- User reviews/ratings
- User accounts/authentication
- Real-time inventory
- E-commerce integration

## User Flow

### Primary User Journey
1. User lands on homepage
2. User either:
   - Enters their address in search field, OR
   - Clicks "Use my location" button
3. Browser/app geocodes the address or retrieves GPS coordinates
4. JavaScript calculates distances to all shops in database
5. Results filtered to 100-mile radius
6. Top 20 results displayed, sorted by distance
7. User views shop details and visits website or gets directions

### Secondary User Journeys
- User wants to suggest a new shop → Clicks "Suggest a shop" → Fills out form → Submits
- User notices a shop has closed → Clicks "Report closed shop" → Selects shop and submits report
- User wants to find shops in different location → Enters new address → Sees new results

## Performance Requirements

### Load Time
- Initial page load: < 2 seconds on 3G connection
- Search results display: < 500ms after location obtained
- JSON data file: < 500KB compressed

### Responsiveness
- Mobile-first responsive design
- Works on screen sizes from 320px to 4K
- Touch-friendly interface elements

## Cost Breakdown

### One-Time Costs
- Initial development time
- Initial data collection and verification
- Domain name setup (optional): $10-15

### Recurring Costs
- **Hosting:** $0 (GitHub Pages)
- **Domain renewal:** $10-15/year (optional)
- **Maintenance:** 2-4 hours quarterly for data updates
- **Form service:** $0 (Formspree free tier: 50 submissions/month, or Google Forms: unlimited)

**Total Annual Cost: $0-15**

## Development Phases

### Phase 1: MVP (Week 1-2)
- [x] Set up static site structure
- [x] Implement location input and geolocation
- [x] Build distance calculation logic
- [x] Create results display
- [x] Compile initial shop database (basic data only)
  - 191 shops from OpenStreetMap (188 independent, 3 chains)
  - 81% with addresses, 61% with websites, 52% with phone numbers
- [ ] Deploy to GitHub Pages

### Phase 2: Data & Forms (Week 3)
- [x] **Replace OSM with Google Places API** (completed 2026-01-25)
  - ✅ Implemented `scripts/sources/google-places.js`
  - ✅ Text Search for "skate shop" across 220+ US metro areas
  - ✅ Stays within free tier (~220 requests vs 5,000/month limit)
  - ✅ Updated `collect-shops.js` to use Google Places as primary source
  - [ ] Run initial collection with API key to generate new dataset
- [ ] Expand skateshop database coverage
  - Add Zumiez store locator data (~600 locations)
  - Add other chains: Vans, Tactics physical locations
  - Populate `scripts/data/chain-stores.json`
- [ ] Add "Suggest a shop" form
- [ ] Add "Report closed shop" form
- [ ] Implement form submission

### Phase 3: Polish (Week 4)
- [x] Responsive design refinement (implemented in initial build)
- [x] Error handling improvements (implemented in initial build)
- [ ] Performance optimization
- [ ] User testing and feedback

### Phase 4: Enhancements (Future)
- Interactive map view
- Additional data fields (hours, photos)
- Advanced filtering options
- Analytics integration

## Success Metrics

### Technical Metrics
- Page load time < 2 seconds
- 100% uptime (via GitHub Pages SLA)
- Mobile usability score > 90 (Google Lighthouse)

### User Metrics
- Time to first result < 5 seconds
- Form submission rate for suggestions/reports
- Return visitor rate

### Data Quality Metrics
- Database coverage (shops per state)
- Data freshness (last update date)
- Accuracy rate (verified shops vs reported closed)

## Maintenance Plan

### Quarterly Updates
1. Review "suggest a shop" submissions
2. Review "report closed shop" submissions
3. Re-run automated data collection script
4. Merge and deduplicate data
5. Verify sample of changes
6. Update JSON file and deploy
7. Update "lastUpdated" timestamp

### Monitoring
- Monitor form submissions weekly
- Check uptime status
- Review any user-reported issues

## Future Considerations

### Potential Expansions
- International coverage (Canada, Europe, etc.)
- Mobile app version (React Native, Flutter)
- Shop owner portal for self-service updates
- Integration with skate event calendars
- Community features (favorite shops, shop highlights)

### Scalability Path
If traffic grows significantly:
1. Add CDN (Cloudflare free tier)
2. Consider API-based approach for real-time data
3. Implement caching strategies
4. Split data by region for faster loading

## Technical Notes

### Geolocation Considerations
- HTTPS required for Geolocation API
- Handle permission denied gracefully
- Provide fallback to address input
- Consider accuracy limitations

### Distance Calculation
Using Haversine formula:
```
a = sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2)
c = 2 * atan2(√a, √(1−a))
d = R * c
```
Where R = Earth's radius (3,959 miles)

### Data Quality Standards
- All shops must have valid coordinates (latitude/longitude)
- Addresses must include city, state, ZIP at minimum
- Websites must be validated URLs (if provided)
- Phone numbers in consistent format (if provided)
- Independent vs chain status must be determined for all shops
- Deduplicate based on name + address similarity

**Shop Inclusion Criteria:**
To be included, a shop must:
1. Sell individual skateboard components (decks, wheels, trucks, bearings, etc.) separately - not just complete pre-built skateboards
2. Have a physical retail location (not online-only)
3. Be currently operating

**Chain Stores:**
Include all chain stores that sell skateboard components, such as:
- Zumiez
- Vans (stores with skate sections)
- Tactics (physical locations)
- Skate Warehouse (physical locations if any)
- Other regional/national chains that meet the component criteria

Exclude stores like Sierra that only sell complete skateboards without individual parts.

**Minimum Data Quality Threshold:**
To be included in the database, a shop must have:
1. Name (verified to exist)
2. Complete address (street, city, state, ZIP)
3. Valid coordinates that match the address
4. Independent/chain classification
5. Verification that they sell skateboard components (not just completes)

Optional fields (website, phone) can be added later if missing initially.

## Risk Mitigation

### Data Staleness
- Clear "Last updated" date visible to users
- Encourage community reporting
- Set calendar reminders for quarterly updates

### Form Spam
- Simple honeypot field
- Consider reCAPTCHA if spam becomes issue
- Email notifications for manual review

### Browser Compatibility
- Test on major browsers and devices
- Provide graceful degradation
- Clear error messages for unsupported features

## Open Questions

- What should the independent shop badge look like? (text style: "INDEPENDENT", "LOCAL", "INDIE"? Or icon-based?)
- What color scheme for the badge? (to match overall site design)
- During data collection, how will we verify which chain stores sell components vs. completes only?

## Follow-up Tasks

1. ~~**Implement Google Places API collection**~~ ✅ Complete
   - Created `scripts/sources/google-places.js` with Text Search integration
   - Covers 220+ US metro areas with "skate shop" queries
   - Stays within free tier (~220 requests vs 5,000/month limit)
   - Requires: `GOOGLE_PLACES_API_KEY` environment variable
2. **Run initial Google Places collection** - Set up API key and generate new dataset
3. **Expand chain store data** - Add Zumiez (~600 locations), Vans stores, Tactics locations to `scripts/data/chain-stores.json`
4. **Deploy to GitHub Pages** - Set up hosting and domain
5. **Add user feedback forms** - "Suggest a shop" and "Report closed shop" features