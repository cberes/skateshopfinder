#!/usr/bin/env node
/**
 * Lookup a specific place in Google Places API
 * Usage: node scripts/lookup-place.js "Food Court skatepark Hamburg NY"
 */

import fetch from 'node-fetch';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

async function lookupPlace(query) {
  if (!API_KEY) {
    console.error('Error: GOOGLE_PLACES_API_KEY environment variable not set');
    process.exit(1);
  }

  const requestBody = {
    textQuery: query,
    regionCode: 'US',
  };

  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.websiteUri',
    'places.nationalPhoneNumber',
    'places.types',
    'places.businessStatus',
    'places.primaryType',
    'places.primaryTypeDisplayName',
  ].join(',');

  try {
    const response = await fetch(TEXT_SEARCH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      process.exit(1);
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      console.log('\nNo results found for:', query);
      return;
    }

    console.log(`\nFound ${data.places.length} result(s) for: "${query}"\n`);

    for (const place of data.places) {
      console.log('='.repeat(60));
      console.log('Name:', place.displayName?.text || 'Unknown');
      console.log('Address:', place.formattedAddress || 'N/A');
      console.log('Coordinates:', place.location?.latitude, ',', place.location?.longitude);
      console.log('Website:', place.websiteUri || 'N/A');
      console.log('Phone:', place.nationalPhoneNumber || 'N/A');
      console.log('Status:', place.businessStatus || 'N/A');
      console.log('Primary Type:', place.primaryType || 'N/A');
      console.log('Primary Type Display:', place.primaryTypeDisplayName?.text || 'N/A');
      console.log('All Types:', (place.types || []).join(', '));
      console.log('Google Place ID:', place.id);
      console.log('');
    }
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

const query = process.argv.slice(2).join(' ');
if (!query) {
  console.log('Usage: node scripts/lookup-place.js "Business name and location"');
  console.log('Example: node scripts/lookup-place.js "Food Court skatepark Hamburg NY"');
  process.exit(1);
}

lookupPlace(query);
