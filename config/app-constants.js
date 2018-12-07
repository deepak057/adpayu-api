require('dotenv').config();//instatiate environment variables

let NOTIFICATIONS = {} //Make this global to use all over the application

NOTIFICATIONS.types = {
	SENT_FRIEND_REQUEST: 'SENT_FRIEND_REQUEST',
	FRIENDSHIP_ACCEPTED: 'FRIENDSHIP_ACCEPTED'
}

module.exports = NOTIFICATIONS;
