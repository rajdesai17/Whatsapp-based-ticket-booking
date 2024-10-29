// This is index.js

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const { connectToDatabase, addMuseum, updateMuseum, deleteMuseum, getBookings } = require('./database');
const { handleMessage } = require('./chatbot');

const rateLimit = new Map();

function checkRateLimit(chatId) {
    const now = Date.now();
    const messageTimestamps = rateLimit.get(chatId) || [];
    const recentMessages = messageTimestamps.filter(timestamp => now - timestamp < 60000);
    
    if (recentMessages.length >= 10) {
        return false;
    }
    
    recentMessages.push(now);
    rateLimit.set(chatId, recentMessages);
    return true;
}

async function handleAdminCommand(command, db) {
    const [_, action, ...args] = command.split(' ');
    switch (action) {
        case 'addMuseum':
            // Assuming args are [name, location, ticketPrice]
            return await addMuseum(db, { name: args[0], location: args[1], ticketPrice: parseFloat(args[2]) });
        case 'updateMuseum':
            // Assuming args are [id, name, location, ticketPrice]
            return await updateMuseum(db, args[0], { name: args[1], location: args[2], ticketPrice: parseFloat(args[3]) });
        case 'deleteMuseum':
            // Assuming args are [id]
            return await deleteMuseum(db, args[0]);
        case 'getBookings':
            // Assuming args are [dateFrom, dateTo]
            return await getBookings(db, args[0], args[1]);
        default:
            return "Unknown admin command";
    }
}

function isAdmin(userId) {
    // Implement your admin check logic here
    // For example, you could have a list of admin user IDs
    const adminUsers = ['1234567890@s.whatsapp.net']; // Replace with actual admin user IDs
    return adminUsers.includes(userId);
}

async function connectToWhatsApp() {
    try {
        console.log('Connecting to database...');
        const db = await connectToDatabase();
        console.log('Database connected successfully');

        console.log('Setting up WhatsApp connection...');
        const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

        const sock = makeWASocket({
            auth: state,
            printQRInTerminal: true,
            connectTimeoutMs: 60_000,
            retryRequestDelayMs: 5000,
        });

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;
            if(connection === 'close') {
                const shouldReconnect = (lastDisconnect.error instanceof Boom &&
                    lastDisconnect.error.output.statusCode !== DisconnectReason.loggedOut);
                console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
                if(shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if(connection === 'open') {
                console.log('WhatsApp connection opened successfully');
            }
        });

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('messages.upsert', async ({ messages }) => {
            console.log('Received message');
            const message = messages[0];
            if (!message.key.fromMe && message.message) {
                const chatId = message.key.remoteJid;
                const messageText = message.message.conversation || message.message.extendedTextMessage?.text || '';
                console.log('Received message:', messageText);

                if (!checkRateLimit(chatId)) {
                    await sock.sendMessage(chatId, { text: "You're sending messages too quickly. Please wait a moment." });
                    return;
                }

                try {
                    let response;
                    if (messageText.startsWith('/admin')) {
                        if (isAdmin(chatId)) {
                            response = await handleAdminCommand(messageText, db);
                        } else {
                            response = "You don't have admin privileges.";
                        }
                    } else {
                        response = await handleMessage(messageText, chatId, db);
                    }
                    await sock.sendMessage(chatId, { text: response });
                    console.log('Sent response:', response);
                } catch (error) {
                    console.error('Error handling message:', error);
                }
            }
        });

        console.log('WhatsApp connection setup complete');
    } catch (error) {
        console.error('Failed to connect:', error);
        console.log('Attempting to reconnect in 10 seconds...');
        setTimeout(connectToWhatsApp, 10000);
    }
}

console.log('Starting WhatsApp bot...');
connectToWhatsApp();