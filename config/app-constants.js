require('dotenv').config();//instatiate environment variables

let NOTIFICATIONS = {} //Make this global to use all over the application

NOTIFICATIONS.types = {
	SENT_FRIEND_REQUEST: 'SENT_FRIEND_REQUEST',
	FRIENDSHIP_ACCEPTED: 'FRIENDSHIP_ACCEPTED',
	COMMENT_ON_POST: 'COMMENT_ON_POST',
  LIKE_ON_POST: 'LIKE_ON_POST',
  LIKE_ON_COMMENT: 'LIKE_ON_COMMENT',
  AD_TARGET_COMPLETED: 'AD_TARGET_COMPLETED',
  AD_TARGET_MANIPULATED: 'AD_TARGET_MANIPULATED'
}

module.exports.NOTIFICATIONS = NOTIFICATIONS;

let ADS = {}

ADS.defaultPricing = {
  defaultCPI: 0.0071,
  defaultCPC: 0.028,
  defaultCPV: 0.21,
  defaultImpressionTarget: 500
}

ADS.processingFeePercentage = 3
ADS.maxAdsToBePushedToTop = 2

module.exports.ADS = ADS;

let TAGS = {}

TAGS.defaultTag = {
  name: 'general'
}

module.exports.TAGS = TAGS;

let MONEY_WITHDRAWL_CONFIG = {
  siteFeePercentage: 10,
  minRequiredAmountINR: 10,
  paymentGatewayCharges: {
    paytm: {
      fixed: 4,
      percentage: 1.5
    },
    bank: {
      fixed: 6,
      percentage: 1
    },
    manual: {
      fixed: 9,
      percentage: 1.2
    }
  }
}

module.exports.MONEY_WITHDRAWL_CONFIG = MONEY_WITHDRAWL_CONFIG;
