// ticketGenerator.js
function generateETicket(ticket) {
    return `
E-TICKET
--------
Museum: ${ticket.museumName}
Date: ${ticket.date}
Number of Tickets: ${ticket.numberOfTickets}
Total Price: $${ticket.totalPrice}
Transaction ID: ${ticket.transactionId}

Please present this e-ticket at the museum entrance.
Thank you for your purchase!
    `.trim();
}

module.exports = { generateETicket };