const { ConsumedAds, Forex, Withdrawals} = require('../models');
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

function getAuthenticationHeader (authenticationToken) {
  return {
     'Authorization': 'Bearer '+ authenticationToken
  }
}

function getRequestOptions (path, headers, method = 'POST') {
  return {
    host: APIConfig.baseURL,
    path: '/payout/v1/'+ path,
    method: method,
    headers: headers
  }
}

/*
* function to authenticate and obtain authentication
* token
*/
function authenticate (details, transaferDetails, user, res) {
  return new Promise(function(resolve, reject) {
    let data = '';

      console.log("Authenticating Cashfree Payout API...")

      var post_req = https.request(getRequestOptions('authorize', {
              'X-Client-Id': APIConfig.secrets.id,
              'X-Client-Secret': APIConfig.secrets.secret
          }), function(resp) {
          resp.on('data', function (chunk) {
               data += chunk;
          });
          resp.on('end', () => {
            let response = JSON.parse(data)
            if (response.status === 'SUCCESS') {
              //return addBeneficiary(details, transaferDetails, response.data.token, user, res)
              resolve(response.data.token)
            } else {
              resolve(false)
            }
            
          });
          resp.on('error', (err) => {
            reject(err)
          })
      });

      post_req.write('');
      post_req.end();

  });


      
}

async function removeBeneficiary (benID, authenticationToken) {
  return new Promise(function(resolve, reject) {
      let data = ''

      let postData = JSON.stringify({
        beneId: benID,
      })

       console.log("Removing Beneficiary...")

        var post_req = https.request(getRequestOptions('removeBeneficiary',getAuthenticationHeader(authenticationToken)), function(resp) {
          resp.on('data', function (chunk) {
               data += chunk;
          });
          resp.on('end', () => {
            resolve(JSON.parse(data))
          });
          resp.on('error', (err) => {
            reject(err)
          })
        });

      post_req.write(postData);
      post_req.end();
  });
  
}

async function addBeneficiary (transactionDetails, transaferDetails, authenticationToken, user) {
  return new Promise(function(resolve, reject) {
      let data = ''

      let postData = JSON.stringify({
        beneId: user.id,
        name: user.first + ' ' + user.last,
        email: user.email,
        phone: transaferDetails.phone,
        bankAccount: transaferDetails.accountNumber,
        ifsc: transaferDetails.IFSC,
        address1: transaferDetails.address
      })

       console.log("Adding Beneficiary...")

        var post_req = https.request(getRequestOptions('addBeneficiary',getAuthenticationHeader(authenticationToken)), function(resp) {
          resp.on('data', function (chunk) {
               data += chunk;
          });
          resp.on('end', () => {
            resolve(JSON.parse(data))
          });
          resp.on('error', (err) => {
            reject(err)
          })
        });

      post_req.write(postData);
      post_req.end();
  });
  
}

async function fetchBeneficiary (transactionDetails, transaferDetails, authenticationToken, user, res) {
  try {

    let err, ben, temp;
    [err, ben] = await to(getBeneficiary(authenticationToken, user.id))

    // remove the beneficiary if bank account details are different than the ones 
    // in records of Cashfree
    if (ben && ifRemoveBeneficiary(ben, transaferDetails)) {
        [err, temp] = await to(removeBeneficiary(ben.data.beneId, authenticationToken))
        if (!err && temp.status === 'SUCCESS') {
          ben = false
        } else {
          console.log(err)
          throw new Error ('Something went wrong while deleting the beneficary.')
        }
    }


    // add the beneficary if it doesn't already exist
    if (!ben) {
      [err, ben] = await to(addBeneficiary(transactionDetails, transaferDetails, authenticationToken, user))
    }

    if (ben.status === 'ERROR') {
      return ReS(res, {
        ben: ben
      }, 200);
    } else {
      requestTransfer (transactionDetails, transaferDetails, authenticationToken, user, res)
        .then((data) => {
          return ReS(res, {
            data: data
         }, 200);
        })
    }
  } catch (e) {
    console.log(e)
    return ReE(res, {success: false, message: 'Something went wrong while during this transaction.'}, 422);
  }
}

async function requestTransfer(transactionDetails, transaferDetails, authenticationToken, user, res) {
  return new Promise(function(resolve, reject) {
      let data = ''

      let postData = {
        beneId: user.id,
        amount: transactionDetails.totalINR,
        transferId: 'rand'+ Math.floor((Math.random() * 1000000) + 1000),
        transferMode: transaferDetails.mode === 'bank' ? 'banktransfer': transaferDetails.mode
      };

      //save this transaction details in database
      recordWithdrawl(transactionDetails, postData)
        .then((withdrawl) => {

          console.log("Requesting transfer...")


            var post_req = https.request(getRequestOptions('requestTransfer',getAuthenticationHeader(authenticationToken)), function(resp) {
              resp.on('data', function (chunk) {
                   data += chunk;
              });
              resp.on('end', () => {
                let response = JSON.parse(data)
                // update the database
                withdrawl.response = data.trim()
                withdrawl.status = response.status
                withdrawl.save()
                  .then ((withdrawlUpdated) => {
                    if (response.status === "SUCCESS") {
                      settleConsumedAdsAmount(user)
                        .then ((userAmountSettled) => {
                          //also, update current user saved bank account details
                          user.bankDetails = JSON.stringify(transaferDetails); user.save()
                          resolve(response)
                        })
                    } else {
                      resolve(response)
                    }
                  })
              });
              resp.on('error', (err) => {
                reject(err)
              })
            });

          post_req.write(JSON.stringify(postData));
          post_req.end();
        })

  });
  
}

/*
* function to keep track of 
* withdrawals
*/

function recordWithdrawl (transactionDetails, transaferDetails) {
  return Withdrawals.create({
    payableAmount: transaferDetails.amount,
    transferMode: transaferDetails.transferMode,
    transferId: transaferDetails.transferId,
    INRPerUSDRate: transactionDetails.forex,
    siteFee: transactionDetails.siteFeeINR,
    paymentGatewayCharges: transactionDetails.paymentGatewayChargeINR,
    UserId: transaferDetails.beneId,
    totalAmount: transactionDetails.amountAccumulatedINR
  })
  .then ((withdrawl) => {
    return new Promise((resolve) => { resolve(withdrawl) })
  })
  .catch((error) => {
    return new Promise((resolve, reject) => { reject(error) })
  })
}

//check if beneficary bank account or paytm details have changed
function ifRemoveBeneficiary (ben, transaferDetails) {
  if ('data' in ben) {
    // if phone number, bank account or IFSC code seem to be changed, the beneficary should
    // be removed so that he can be added again with new details
    return String(ben.data.phone) !== transaferDetails.phone || ben.data.bankAccount !== transaferDetails.accountNumber || ben.data.ifsc !== transaferDetails.IFSC
  }

  return false
}

// function to reset all the consumed ad status
// for current user

function settleConsumedAdsAmount (user) {
  return ConsumedAds.update({
    settled: true
  },{
    where: {
      UserId: user.id
    }
  })
    .then ((updated) => {
      return new Promise((resolve) => { resolve(updated) })
    })
    .catch((error) => {
      return new Promise((resolve, reject) => { reject(error) })
    })
}

function getBeneficiary (token, benId) {
  
  return new Promise(function(resolve, reject) {

    let data = '';

    console.log("Getting Beneficiary...")

    var get_req = https.request(getRequestOptions('getBeneficiary/'+benId, getAuthenticationHeader(token), 'GET'), function(resp) {
      resp.on('data', function (chunk) {
           data += chunk;
      });
      resp.on('end', () => {
        console.log(data)
          let response = JSON.parse(data)
          if (response.subCode === '404') {
             resolve(false)
          } else {
             resolve(response)
          }
        })
      resp.on('error', (err) => {
        reject(error)
      })
  });

  get_req.write('');
  get_req.end();

  });
}

const withdraw = async function (req, res) {
  try {
    let details, err;
    [err, details] =await to(getTransactionDetails(req.user, req.body.mode))
    if (!err) {
      authenticate(details, req.body, req.user, res)
        .then((token) => {
          if (token) {
            fetchBeneficiary(details, req.body, token, req.user, res)
          } else {
            //throw new Error ('Something went wrong while obtaining the security token.')
            return ReE(res, {success: false, message: 'Something went wrong while obtaining the security token.'}, 422);
          }
        })
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
    let details, err, user = req.user;
    [err, details] =await to(getTransactionDetails(user, req.query.mode))
    if (!err) {
      return ReS(res, {
        transaction: details,
        userBankDetails: JSON.parse(user.bankDetails)
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
      totalINR: totalINR,
      forex: forex,
    }, mode)

}

async function addPaymentGatewayCharges (transactionDetails, mode) {
  try {

    let PGCharges = MONEY_WITHDRAWL_CONFIG.paymentGatewayCharges[mode]

    let temp = (transactionDetails.totalINR / 100) * PGCharges.percentage

    let charges = roundTwoDecimalPlaces((temp > PGCharges.fixed ? temp : PGCharges.fixed));

    transactionDetails.totalINR -= charges
    transactionDetails.paymentGatewayChargeINR = charges
    transactionDetails.paymentGatewayChargeUSD = roundTwoDecimalPlaces(transactionDetails.paymentGatewayChargeINR/parseFloat(transactionDetails.forex))
    transactionDetails.totalUSD -= transactionDetails.paymentGatewayChargeUSD
    // transactionDetails.siteFeePercentage = roundTwoDecimalPlaces((transactionDetails.siteFeeINR * 100) / transactionDetails.amountAccumulatedINR);

    return transactionDetails
  } catch (e) {
    throw e
  }

}