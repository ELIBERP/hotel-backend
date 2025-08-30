const hotelApi = process.env.HOTELAPI || 'https://hotelapi.loyalty.dev';
const hotel = {};

hotel.find = async (destination_id) => {
    // COMMENTED OUT (API CALL)
    /*
    const params = new URLSearchParams({
        destination_id: destination_id,
    });
    const response = await fetch(`${hotelApi}/api/hotels?${params.toString()}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
    if (response.status !== 200) {
        return new Error(`HTTP error! status: ${response.status}`);
    }
    // console.log(response);
    const data = await response.json();
    // console.log(data);
    return data;
    */
    
    // Using static assets instead
    console.log(`Using static assets for destination_id: ${destination_id}`);
    try {
        // Import static hotel data for the destination
        const fs = await import('fs').then(module => module.default);
        const path = await import('path').then(module => module.default);
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const staticDataPath = path.join(__dirname, '../static/hotels.json');
        const hotelsData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
        
        // Filter hotels by destination if needed
        return destination_id ? 
            hotelsData.filter(hotel => hotel.destination_id === destination_id) : 
            hotelsData;
    } catch (error) {
        console.error('Error loading static hotel data:', error);
        return [];
    }
}

hotel.findByPrice = async (query) => {
    // COMMENTED OUT (API CALL)
    /*
    const params = new URLSearchParams(query);
    const response = await fetch(`${hotelApi}/api/hotels/prices?${params.toString()}`,
        {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
        }
    );
    if (response.status !== 200) {
        return new Error(`HTTP error! status: ${response.status}`);
    }
    // console.log(response);
    const data = await response.json();
    // console.log(data);
    return data;
    */
    
    // Using static assets instead
    console.log(`Using static assets for price search with query:`, query);
    try {
        // Import static hotel price data
        const fs = await import('fs').then(module => module.default);
        const path = await import('path').then(module => module.default);
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const staticDataPath = path.join(__dirname, '../static/hotel_prices.json');
        const pricesData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
        
        // Return the static data (with minimal filtering if needed)
        const destination_id = query.destination_id;
        return destination_id ? 
            { results: pricesData.filter(hotel => hotel.destination_id === destination_id) } : 
            { results: pricesData };
    } catch (error) {
        console.error('Error loading static hotel price data:', error);
        return { results: [] };
    }
}

// Calls the Ascenda /api/hotels/:id API directly and return the result
hotel.findById = async (hotelId) => {
    // COMMENTED OUT (API CALL)
    /*
    const response = await fetch(`${hotelApi}/api/hotels/${hotelId}`);
    if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
    */
    
    // Using static assets instead
    console.log(`Using static assets for hotel ID: ${hotelId}`);
    try {
        // Import static hotel detail data
        const fs = await import('fs').then(module => module.default);
        const path = await import('path').then(module => module.default);
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const staticDataPath = path.join(__dirname, '../static/hotels.json');
        const hotelsData = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
        
        // Find the specific hotel by ID
        const hotel = hotelsData.find(h => h.id === hotelId);
        if (!hotel) {
            throw new Error(`Hotel with ID ${hotelId} not found in static data`);
        }
        return hotel;
    } catch (error) {
        console.error('Error loading static hotel detail data:', error);
        throw error;
    }
};

// Calls the Ascenda /api/hotels/:id/prices and return the results
hotel.findRoomsByID = async (hotelId, query) => {
    // COMMENTED OUT (API CALL)
    /*
    const params = new URLSearchParams(query).toString();
    let url = `${hotelApi}/api/hotels/${hotelId}/price?${params}`;
    let data;
    while (true) {
        const response = await fetch(url);
        if (response.status !== 200) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        data = await response.json();
        if (data.completed === true) {
            break;
        }
        // Add a short delay to avoid hammering the API
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    */

    // Using static assets instead
    console.log(`Using static assets for hotel rooms, hotel ID: ${hotelId}, query:`, query);
    try {
        // Import static hotel rooms data
        const fs = await import('fs').then(module => module.default);
        const path = await import('path').then(module => module.default);
        const { fileURLToPath } = await import('url');
        
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        
        const staticDataPath = path.join(__dirname, '../static/hotel_rooms.json');
        let data = JSON.parse(fs.readFileSync(staticDataPath, 'utf8'));
        
        // Find rooms for the specific hotel
        // If hotel_rooms.json is structured as a collection, filter by hotelId
        if (Array.isArray(data)) {
            data = data.find(item => item.hotelId === hotelId) || { 
                completed: true,
                rooms: []
            };
        }
        
        // Set completed to true to simulate API completion
        data.completed = true;
    
        const roomMap = new Map(); // key = roomDescription, value = room object
        for (const room of data.rooms || []) {
            const existing = roomMap.get(room.roomDescription);
            if (!existing || room.price < existing.price) {
                roomMap.set(room.roomDescription, room);
            }
        }
    
        const filteredData = {
            ...data,
            rooms: Array.from(roomMap.values()),
        };
    
        return filteredData;
    } catch (error) {
        console.error('Error loading static hotel rooms data:', error);
        return { completed: true, rooms: [] };
    }
};


export default hotel;