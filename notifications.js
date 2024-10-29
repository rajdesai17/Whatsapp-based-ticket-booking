// notifications.js
const schedule = require('node-schedule');

function scheduleReminder(sock, chatId, museumName, date) {
    const reminderDate = new Date(date);
    reminderDate.setDate(reminderDate.getDate() - 1);

    schedule.scheduleJob(reminderDate, function() {
        sock.sendMessage(chatId, { text: `Reminder: Your visit to ${museumName} is tomorrow!` });
    });
}

module.exports = { scheduleReminder };