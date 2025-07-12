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

// Calls the Ascenda /api/hotels/:id API directly and return the result
hotel.findById = async (hotelId) => {
    const response = await fetch(`${hotelApi}/api/hotels/${hotelId}`);
    if (response.status !== 200) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data;
};


export default hotel;