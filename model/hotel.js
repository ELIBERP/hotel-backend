const hotelApi = process.env.HOTELAPI || 'https://hotelapi.loyalty.dev';
const hotel = {};

hotel.find = async (destination_id) => {
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
}

hotel.findByPrice = async (query) => {
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
}

// Calls the Ascenda /api/hotels/:id API directly and return the result
hotel.findById = async (hotelId) => {
    const response = await fetch(`${hotelApi}/api/hotels/${hotelId}`);
    if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
};

// Calls the Ascenda /api/hotels/:id/prices and return the results
hotel.findRoomsByID = async (hotelId, query) => {
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

    const roomMap = new Map(); // key = roomDescription, value = room object
    for (const room of data.rooms) {
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
};


export default hotel;