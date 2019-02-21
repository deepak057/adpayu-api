require('dotenv').config();//instatiate environment variables

let NOTIFICATIONS = {} //Make this global to use all over the application

NOTIFICATIONS.types = {
	SENT_FRIEND_REQUEST: 'SENT_FRIEND_REQUEST',
	FRIENDSHIP_ACCEPTED: 'FRIENDSHIP_ACCEPTED',
	COMMENT_ON_POST: 'COMMENT_ON_POST',
    LIKE_ON_POST: 'LIKE_ON_POST',
    LIKE_ON_COMMENT: 'LIKE_ON_COMMENT',
    AD_TARGET_COMPLETED: 'AD_TARGET_COMPLETED'
}

module.exports.NOTIFICATIONS = NOTIFICATIONS;

let ADS = {}

ADS.defaultPricing = {
  defaultCPI: 0.0071,
  defaultCPC: 0.028,
  defaultCPV: 0.21,
  defaultImpressionTarget: 500
}

module.exports.ADS = ADS;
