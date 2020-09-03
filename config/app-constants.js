require('dotenv').config();//instatiate environment variables

let NOTIFICATIONS = {} //Make this global to use all over the application

NOTIFICATIONS.types = {
	SENT_FRIEND_REQUEST: 'SENT_FRIEND_REQUEST',
	FRIENDSHIP_ACCEPTED: 'FRIENDSHIP_ACCEPTED',
	COMMENT_ON_POST: 'COMMENT_ON_POST',
  LIKE_ON_POST: 'LIKE_ON_POST',
  LIKE_ON_COMMENT: 'LIKE_ON_COMMENT',
  AD_TARGET_COMPLETED: 'AD_TARGET_COMPLETED',
  AD_TARGET_MANIPULATED: 'AD_TARGET_MANIPULATED',
  VIDEO_COMMENT_ACCEPTED: 'VIDEO_COMMENT_ACCEPTED',
  VIDEO_COMMENT_REJECTED: 'VIDEO_COMMENT_REJECTED',
  COMMENT_ASSOCIATION_CHANGED: 'COMMENT_ASSOCIATION_CHANGED',
  IDENTITY_DOCS_APPROVED: 'IDENTITY_DOCS_APPROVED',
  IDENTITY_DOCS_REJECTED: 'IDENTITY_DOCS_REJECTED',
  REACTION_POSTED: 'REACTION_POSTED'
}

module.exports.NOTIFICATIONS = NOTIFICATIONS;

let ADS = {}

ADS.defaultPricing = {
  defaultCPI: 0.0071,
  defaultCPC: 0.014,
  defaultCPV: 0.021,
  defaultImpressionTarget: 500
}

ADS.processingFeePercentage = 3
ADS.maxAdsToBePushedToTop = 2
ADS.actions = {
  impression: 'impression',
  click: 'click',
  view: 'view',
  videoComment: 'videoComment'
}
ADS.adsRestrictionPolicy = {
  maxAdsToShowOnRegistration: 3,
  daysInterval: 1,
  maxAdsToShowOnInterval: 2
}
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
      fixed: 5,
      percentage: 1
    }
  }
}

module.exports.MONEY_WITHDRAWL_CONFIG = MONEY_WITHDRAWL_CONFIG;

let VIDEO_PAYMENT_CONFIG = {
  perVideoPriceINR: 10
}

module.exports.VIDEO_PAYMENT_CONFIG = VIDEO_PAYMENT_CONFIG;

GENERAL = {
  CASHBACK: {
    KYC: {
      enable: true,
      priceINR: 10
    },
    FirstAd: {
      enable: true,
      priceINR: 10
    }
  }
}

module.exports.GENERAL = GENERAL;
