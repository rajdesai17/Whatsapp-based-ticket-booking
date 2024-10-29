const { getMuseums, getMuseum, createTicket, deleteBooking, getAllMuseums } = require('./database');
const { processPayment, createPaymentIntent } = require('./paymentSystem');
const { generateETicket } = require('./ticketGenerator');

const CONVERSATION_STATES = {
    IDLE: 'IDLE',
    SELECTING_MUSEUM: 'SELECTING_MUSEUM',
    SELECTING_DATE: 'SELECTING_DATE',
    SELECTING_TICKETS: 'SELECTING_TICKETS',
    PROCESSING_PAYMENT: 'PROCESSING_PAYMENT',
    CONFIRMING_BOOKING: 'CONFIRMING_BOOKING',
    CANCELLING_BOOKING: 'CANCELLING_BOOKING',
    MODIFYING_BOOKING: 'MODIFYING_BOOKING'
};

const conversationState = new Map();
const userSelections = new Map();

function handleError(error, chatId) {
    console.error(`Error for chat ${chatId}:`, error);
    conversationState.set(chatId, CONVERSATION_STATES.IDLE);
    userSelections.delete(chatId);
    return "I'm sorry, but an error occurred. Please try again or contact support.";
}

function sanitizeInput(input) {
    // Preserve hyphens for date inputs, remove other special characters
    return input.replace(/[^a-zA-Z0-9\s-]/g, '');
}

function isValidMuseumSelection(input, museumCount) {
    const selection = parseInt(input);
    return !isNaN(selection) && selection > 0 && selection <= museumCount;
}

function isValidTicketCount(input) {
    const count = parseInt(input);
    return !isNaN(count) && count > 0 && count <= 10; // Limit to 10 tickets per booking
}

const isValidDate = (dateString) => {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) return false;

    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day); // month is 0-indexed in JavaScript Date
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if the date is valid and not in the past
    if (!(date instanceof Date && !isNaN(date)) || date < today) {
        return false;
    }

    // Check if the parsed date matches the input
    return (
        date.getFullYear() === year &&
        date.getMonth() === month - 1 &&
        date.getDate() === day
    );
};

const checkAvailability = (date, museumId) => {
    // This is a mock function. In a real scenario, you'd check against your database
    const randomAvailability = Math.random() > 0.2; // 80% chance of availability
    return randomAvailability;
};

async function handleMessage(message, chatId, db) {
    let currentState = conversationState.get(chatId) || CONVERSATION_STATES.IDLE;
    let response;

    try {
        switch (currentState) {
            case CONVERSATION_STATES.IDLE:
                response = await handleIdleState(message, chatId, db);
                break;
            case CONVERSATION_STATES.SELECTING_MUSEUM:
                response = await handleSelectingMuseum(message, chatId, db);
                break;
            case CONVERSATION_STATES.SELECTING_DATE:
                response = await handleSelectingDate(message, chatId);
                break;
            case CONVERSATION_STATES.SELECTING_TICKETS:
                response = await handleSelectingTickets(message, chatId);
                break;
            case CONVERSATION_STATES.CONFIRMING_BOOKING:
                response = await handleConfirmingBooking(message, chatId, db);
                break;
            case CONVERSATION_STATES.PROCESSING_PAYMENT:
                response = await handleProcessingPayment(message, chatId, db);
                break;
            case CONVERSATION_STATES.CANCELLING_BOOKING:
                response = await handleCancellingBooking(message, chatId, db);
                break;
            case CONVERSATION_STATES.MODIFYING_BOOKING:
                response = await handleModifyingBooking(message, chatId, db);
                break;
        }
    } catch (error) {
        response = handleError(error, chatId);
    }

    return response || "I'm sorry, I didn't understand that. Can you please try again?";
}

async function handleIdleState(message, chatId, db) {
    const sanitizedMessage = sanitizeInput(message);
    if (sanitizedMessage.toLowerCase().includes('book') || sanitizedMessage.toLowerCase().includes('ticket')) {
        conversationState.set(chatId, CONVERSATION_STATES.SELECTING_MUSEUM);
        const museums = await getAllMuseums(db);
        let museumList = "Available Museums:\n\n";
        museums.forEach((museum, index) => {
            // Ensure the correct property names are accessed
            museumList += `${index + 1}. ${museum.name} - $${museum.ticketPrice}\n`;
        });
        museumList += "\nPlease select a museum by entering its number.";
        return museumList;
    } else {
        return "Welcome to our museum ticketing service! Type 'book' to start booking tickets.";
    }
}

async function handleSelectingMuseum(message, chatId, db) {
    try {
        const sanitizedMessage = sanitizeInput(message);
        const museums = await getAllMuseums(db);
        if (!isValidMuseumSelection(sanitizedMessage, museums.length)) {
            return "Invalid museum selection. Please try again.";
        }
        const selection = parseInt(sanitizedMessage);
        const selectedMuseum = museums[selection - 1];
        userSelections.set(chatId, { museum: selectedMuseum });
        conversationState.set(chatId, CONVERSATION_STATES.SELECTING_DATE);
        return `You've selected ${selectedMuseum.name}. Please enter the date you'd like to visit (YYYY-MM-DD):`;
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleSelectingDate(message, chatId) {
    try {
        const sanitizedMessage = sanitizeInput(message);
        console.log("Sanitized date:", sanitizedMessage);

        // Reformat the date if hyphens are missing
        const formattedDate = sanitizedMessage.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
        console.log("Formatted date:", formattedDate);

        if (!isValidDate(formattedDate)) {
            return "Invalid date. Please use YYYY-MM-DD format and ensure the date is not in the past and is a valid date.";
        }

        const userSelection = userSelections.get(chatId);
        console.log("User selection:", userSelection);
        const isAvailable = checkAvailability(formattedDate, userSelection.museum.museumId);
        console.log("Is available:", isAvailable);

        if (!isAvailable) {
            return "Sorry, that date is not available. Please choose another date.";
        }

        userSelection.date = formattedDate;
        userSelections.set(chatId, userSelection);
        conversationState.set(chatId, CONVERSATION_STATES.SELECTING_TICKETS);
        return "How many tickets would you like? (Max 10)";
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleSelectingTickets(message, chatId) {
    try {
        const sanitizedMessage = sanitizeInput(message);
        if (!isValidTicketCount(sanitizedMessage)) {
            return "Invalid ticket count. Please enter a number between 1 and 10.";
        }
        const numberOfTickets = parseInt(sanitizedMessage);
        const userSelection = userSelections.get(chatId);
        userSelection.tickets = numberOfTickets;
        userSelections.set(chatId, userSelection);
        conversationState.set(chatId, CONVERSATION_STATES.CONFIRMING_BOOKING);
        const totalPrice = userSelection.museum.ticketPrice * numberOfTickets;
        return `Please confirm your booking:\n${numberOfTickets} ticket(s) for ${userSelection.museum.name} on ${userSelection.date}\nTotal price: $${totalPrice}\nType 'yes' to confirm or 'no' to cancel.`;
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleConfirmingBooking(message, chatId, db) {
    try {
        const sanitizedMessage = sanitizeInput(message).toLowerCase();
        if (sanitizedMessage === 'yes') {
            const userSelection = userSelections.get(chatId);
            const totalPrice = userSelection.museum.ticketPrice * userSelection.tickets;
            
            const ticket = {
                museum: userSelection.museum,
                date: userSelection.date,
                numberOfTickets: userSelection.tickets,
                totalPrice: totalPrice,
                chatId: chatId,
                transactionId: 'TXN' + Date.now() // Simple transaction ID generation
            };

            await createTicket(db, ticket);
            
            conversationState.set(chatId, CONVERSATION_STATES.IDLE);
            userSelections.delete(chatId);
            
            return `Booking confirmed! Your ticket details:\nMuseum: ${ticket.museum.name}\nDate: ${ticket.date}\nTickets: ${ticket.numberOfTickets}\nTotal Price: $${ticket.totalPrice}\nTransaction ID: ${ticket.transactionId}\n\nThank you for booking with us!`;
        } else if (sanitizedMessage === 'no') {
            conversationState.set(chatId, CONVERSATION_STATES.IDLE);
            userSelections.delete(chatId);
            return "Booking canceled. If you need to book again, just let me know!";
        } else {
            return "Please type 'yes' to confirm or 'no' to cancel.";
        }
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleProcessingPayment(message, chatId, db) {
    // Placeholder implementation for payment processing
    try {
        // Payment processing logic here
        conversationState.set(chatId, CONVERSATION_STATES.IDLE);
        userSelections.delete(chatId);
        return "Payment processed successfully. Your booking is confirmed!";
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleCancellingBooking(message, chatId, db) {
    // Placeholder implementation for booking cancellation
    try {
        // Booking cancellation logic here
        conversationState.set(chatId, CONVERSATION_STATES.IDLE);
        userSelections.delete(chatId);
        return "Your booking has been canceled.";
    } catch (error) {
        return handleError(error, chatId);
    }
}

async function handleModifyingBooking(message, chatId, db) {
    // Placeholder implementation for booking modification
    try {
        // Booking modification logic here
        conversationState.set(chatId, CONVERSATION_STATES.IDLE);
        userSelections.delete(chatId);
        return "Your booking has been modified.";
    } catch (error) {
        return handleError(error, chatId);
    }
}

module.exports = { handleMessage };
