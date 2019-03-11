const { ConsumedAds, Forex} = require('../models');
const { to, ReE, ReS, roundTwoDecimalPlaces } = require('../services/util.service');
const { MONEY_WITHDRAWL_CONFIG } = require('../config/app-constants');
const NotificationsController   = require('./notifications.controller');

const withdrawOverview = async function (req, res) {
  try {
    let details, err;
    [err, details] =await to(getTransactionDetails(req.user))
    if (!err) {
      return ReS(res, {
        transaction: details
      }, 200);
    } else {
      console.log(err)
      throw new Error ('Transaction details not found.')
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {success: false, message: 'Something went wrong while getting the details about this transaction.'}, 422);
  }
}

module.exports.withdrawOverview = withdrawOverview;

async function getTransactionDetails (user) {
  let err, amountUSD, amountINR, siteFeePercentage= MONEY_WITHDRAWL_CONFIG.siteFeePercentage,  siteFeeUSD, totalUSD, totalINR, siteFeeINR, forex;

   //get total amount of money in USD which current user has accumlated
    [err, amountUSD] = await to(ConsumedAds.getUserTotal(user.id));
    if(err) {
      throw err
      return false
    }

    /*
    * Get USD to INR forex rate
    */
    [err, forex] = await to(Forex.getUSD2INR());
    if(err) return ReE(res, err, 422);

    amountINR = roundTwoDecimalPlaces(parseFloat(forex) * amountUSD);

    siteFeeUSD = roundTwoDecimalPlaces( (amountUSD / 100 ) * siteFeePercentage )

    siteFeeINR = roundTwoDecimalPlaces( (amountINR / 100 ) * siteFeePercentage )

    totalUSD = roundTwoDecimalPlaces(amountUSD - siteFeeUSD);

    totalINR = roundTwoDecimalPlaces(amountINR - siteFeeINR);

    return {
      amountAccumulatedUSD: amountUSD,
      amountAccumulatedINR: amountINR,
      siteFeePercentage: siteFeePercentage,
      siteFeeUSD: siteFeeUSD,
      siteFeeINR: siteFeeINR,
      totalUSD: totalUSD,
      totalINR: totalINR
    }

}