const { MongoClient, ObjectId } = require('mongodb');
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');

function generateTicketId() {
    return uuidv4();
}

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connectToDatabase() {
    try {
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db('museum_tickets');
        
        // Create collections if they don't exist
        await db.createCollection('museums');
        await db.createCollection('tickets');
        
        // Create indexes
        await db.collection('museums').createIndex({ museumId: 1 }, { unique: true });
        await db.collection('tickets').createIndex({ ticketId: 1 }, { unique: true });
        
        return db;
    } catch (error) {
        console.error('Failed to connect to MongoDB', error);
        process.exit(1);
    }
}

async function addMuseum(db, museum) {
    museum.museumId = uuidv4(); // Ensure each museum has a unique ID
    return await db.collection('museums').insertOne(museum);
}

async function getMuseums(db) {
    return await db.collection('museums').find({}).toArray();
}

async function getMuseum(db, museumId) {
    return await db.collection('museums').findOne({ museumId });
}

async function updateMuseum(db, id, museum) {
    return await db.collection('museums').updateOne(
        { museumId: id },
        { $set: museum }
    );
}

async function deleteMuseum(db, id) {
    return await db.collection('museums').deleteOne({ museumId: id });
}

async function createTicket(db, ticket) {
    return await db.collection('bookings').insertOne({
        museumId: ticket.museum._id,
        museumName: ticket.museum.museumName,
        date: ticket.date,
        numberOfTickets: ticket.numberOfTickets,
        totalPrice: ticket.totalPrice,
        chatId: ticket.chatId,
        transactionId: ticket.transactionId
    });
}

async function getTicket(db, ticketId) {
    if (!ticketId) {
        throw new Error('Invalid ticketId');
    }
    return await db.collection('tickets').findOne({ ticketId });
}

async function getBookings(db, dateFrom, dateTo) {
    return await db.collection('tickets').find({
        date: { $gte: new Date(dateFrom), $lte: new Date(dateTo) }
    }).toArray();
}

async function getAllMuseums(db) {
    return await db.collection('museums').find({}, { projection: { museumName: 1, ticketPrice: 1 } }).toArray();
}

module.exports = {
    connectToDatabase,
    addMuseum,
    getMuseum,
    getMuseums,
    updateMuseum,
    deleteMuseum,
    createTicket,
    getTicket,
    getBookings,
    getAllMuseums
};