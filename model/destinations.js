import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const destinationsData = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../destinations.json'), 'utf8')
);

const destinations = {};

// Search destinations by partial term (for autocomplete)
destinations.search = (query) => {
    if (!query || typeof query !== 'string') {
        return [];
    }

    // Sanitize input - remove special characters and trim whitespace
    const sanitizedQuery = query.trim().replace(/[^a-zA-Z0-9\s]/g, '');
    
    if (sanitizedQuery.length === 0) {
        return [];
    }

    const searchTerm = sanitizedQuery.toLowerCase();
    
    return destinationsData
        .filter(destination => 
            destination.term && destination.term.toLowerCase().includes(searchTerm)
        )
        .slice(0, 10); // Limit to 10 results for autocomplete
};

// Get destination by UID (for validation)
destinations.getById = (uid) => {
    if (!uid || typeof uid !== 'string') {
        return null;
    }
    
    const found = destinationsData.find(destination => destination.uid === uid);
    return found || null;
};

export default destinations;
