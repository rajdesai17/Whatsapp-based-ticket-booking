// paymentSystem.js
function processPayment(amount) {
    return new Promise((resolve) => {
        // Simulate payment processing
        setTimeout(() => {
            resolve({ success: true, transactionId: Math.random().toString(36).substring(7) });
        }, 2000); // Simulate a 2-second payment process
    });
}

module.exports = { processPayment };