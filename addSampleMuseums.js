// addSampleMuseums.js
const { connectToDatabase, addMuseum } = require('./database');

async function addSampleMuseums() {
    const db = await connectToDatabase();
    
    const museums = [
        { museumId: 'LOUVRE001', name: 'The Louvre', location: 'Paris, France', ticketPrice: 20 },
        { museumId: 'MOMA002', name: 'Museum of Modern Art', location: 'New York, USA', ticketPrice: 25 },
        { museumId: 'BRITISH003', name: 'British Museum', location: 'London, UK', ticketPrice: 18 },
    ];

    for (const museum of museums) {
        await addMuseum(db, museum);
        console.log(`Added museum: ${museum.name}`);
    }

    console.log('Sample museums added successfully');
    process.exit(0);
}

addSampleMuseums();