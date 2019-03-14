const { ConsumedAds, Forex} = require('../models');
const { to, ReE, ReS, roundTwoDecimalPlaces } = require('../services/util.service');
const { MONEY_WITHDRAWL_CONFIG } = require('../config/app-constants');
const NotificationsController   = require('./notifications.controller');
require('dotenv').config();//instatiate environment variables
const https = require('https');

const APIConfig = {
  /* test */
  baseURL: 'payout-gamma.cashfree.com',
  /* production */
  //baseURL: 'https://payout-api.cashfree.com', 
  secrets: {
    id: process.env.CASHFREE_PAYOUT_CLIENT_ID,
    secret: process.env.CASHFREE_PAYOUT_CLIENT_SECRET
  }
}

function authenticate () {

  // An object of options to indicate where to post to
  var post_options = {
      host: APIConfig.baseURL,
      path: '/payout/v1/authorize',
      method: 'POST',
      headers: {
          'X-Client-Id': APIConfig.secrets.id,
          'X-Client-Secret': APIConfig.secrets.secret
      }
  };

  let data = '';

  console.log("Authenticating Cashfree Payout API...")

  // Set up the request
  var post_req = https.request(post_options, function(resp) {
      resp.on('data', function (chunk) {
           data += chunk;
      });
      resp.on('end', () => {
        console.log('Cashfree Payout authentication response-' + data)
      });
      resp.on('error', (err) => {
        console.log(err)
      })
  });

post_req.write('');
post_req.end();
}

const withdraw = async function (req, res) {
  try {
    let details, err;
    [err, details] =await to(getTransactionDetails(req.user, req.body.mode))
    if (!err) {
      authenticate()
    } else {
      console.log(err)
      throw new Error ('Transaction details not found.')
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {success: false, message: 'Something went wrong while getting the details about this transaction.'}, 422);
  }
}

module.exports.withdraw = withdraw;

const withdrawOverview = async function (req, res) {
  try {
    let details, err;
    [err, details] =await to(getTransactionDetails(req.user, req.query.mode))
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

async function getTransactionDetails (user, mode = 'bank') {
  let err, amountUSD, amountINR, moneyWithdrawlConfig = MONEY_WITHDRAWL_CONFIG, siteFeePercentage= moneyWithdrawlConfig.siteFeePercentage,  siteFeeUSD, totalUSD, totalINR, siteFeeINR, forex;

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

    // quit if the amount accumulated is less than minimum withdrawl amount
    if(amountINR < moneyWithdrawlConfig.minRequiredAmountINR) {
      let minRequiredAmountUSD = roundTwoDecimalPlaces(moneyWithdrawlConfig.minRequiredAmountINR/forex);
      return {
        success: false,
        message: 'Sorry, you must make at least $' +minRequiredAmountUSD + ' (' +moneyWithdrawlConfig.minRequiredAmountINR + ' INR) in order to withdraw money.'
      }
    }

    siteFeeUSD = roundTwoDecimalPlaces( (amountUSD / 100 ) * siteFeePercentage )

    siteFeeINR = roundTwoDecimalPlaces( (amountINR / 100 ) * siteFeePercentage )

    /*
    * total payable charges
    */
    totalUSD = roundTwoDecimalPlaces(amountUSD - siteFeeUSD);
    totalINR = roundTwoDecimalPlaces(amountINR - siteFeeINR);

    return addPaymentGatewayCharges({
      success: true,
      amountAccumulatedUSD: amountUSD,
      amountAccumulatedINR: amountINR,
      siteFeePercentage: siteFeePercentage,
      siteFeeUSD: siteFeeUSD,
      siteFeeINR: siteFeeINR,
      totalUSD: totalUSD,
      totalINR: totalINR
    }, mode, forex)

}

async function addPaymentGatewayCharges (transactionDetails, mode, forex) {
  try {

    let PGCharges = MONEY_WITHDRAWL_CONFIG.paymentGatewayCharges[mode]

    let temp = (transactionDetails.totalINR / 100) * PGCharges.percentage

    let charges = temp > PGCharges.fixed ? temp : PGCharges.fixed;

    transactionDetails.totalINR -= charges
    transactionDetails.paymentGatewayChargeINR = charges
    transactionDetails.paymentGatewayChargeUSD = roundTwoDecimalPlaces(transactionDetails.paymentGatewayChargeINR/parseFloat(forex))
    transactionDetails.totalUSD -= transactionDetails.paymentGatewayChargeUSD
    // transactionDetails.siteFeePercentage = roundTwoDecimalPlaces((transactionDetails.siteFeeINR * 100) / transactionDetails.amountAccumulatedINR);

    return transactionDetails
  } catch (e) {
    throw e
  }

}