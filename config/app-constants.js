require('dotenv').config();//instatiate environment variables

let NOTIFICATIONS = {} //Make this global to use all over the application

NOTIFICATIONS.types = {
	SENT_FRIEND_REQUEST: 'SENT_FRIEND_REQUEST',
	FRIENDSHIP_ACCEPTED: 'FRIENDSHIP_ACCEPTED',
	COMMENT_ON_POST: 'COMMENT_ON_POST',
    LIKE_ON_POST: 'LIKE_ON_POST',
    LIKE_ON_COMMENT: 'LIKE_ON_COMMENT'
}

module.exports = NOTIFICATIONS;
