const { Orders, Forex } = require('../models');
const { to, ReE, ReS, roundTwoDecimalPlaces } = require('../services/util.service');
const Sequelize = require('sequelize');
var crypto = require('crypto');
require('dotenv').config();//instatiate environment variables
const { ADS } = require('../config/app-constants');

const getToken = async function(req, res){

	try {

		let err, forex, amountINR, amountUSD = parseFloat(req.query.orderAmount), processingFeePercentage = ADS.processingFeePercentage, processingFeeINR, processingFeeUSD, orderAmount, orderAmountUSD;
		
		/*
		* Get USD to INR forex rate
		*/
		[err, forex] = await to(Forex.getUSD2INR());
        if(err) return ReE(res, err, 422);

        /*
        * convert the given USD amount to INR
        * and round the figure upto two decimal places
        */
        amountINR = roundTwoDecimalPlaces((amountUSD * forex))

        /*
        * calculate processing fee in USD
        */
        processingFeeUSD = roundTwoDecimalPlaces( (amountUSD / 100 ) * processingFeePercentage )

        /*
        * Total order amount in USD
        */
        orderAmountUSD = roundTwoDecimalPlaces(amountUSD + processingFeeUSD)

        /*
        * calculate Processing Fee in INR
        */
        processingFeeINR = roundTwoDecimalPlaces( (amountINR / 100 ) * processingFeePercentage )

        /**
        ** Toal Order amount in INR
        **/
        orderAmount = roundTwoDecimalPlaces(amountINR + processingFeeINR)

		/**
	    ** Keep track of this order
	    ** in system's database
	    **/

	    Orders.create({amount: amountINR, INRPerUSDRate: forex, processingFeePercentage: processingFeePercentage})
	      .then ((order) => {
	      	
	        order.setUser(req.user);

		    //get CashFree payment gateway's secret credentials
			let appId = process.env.CASHFREE_APP_ID;
			let appSecret = process.env.CASHFREE_SECRET_KEY;

			//OrderId
			let orderId = order.id;

			//adding OrderId as query parameter to the Return URL
			let returnUrl = req.query.returnUrl + '/?orderId='+orderId;
			
			/*
			* create the whole query string based
			** on the supplied parameters
			*/
		    let queryString = 'appId='+ appId + '&orderId=' + orderId + '&orderAmount=' + orderAmount + '&returnUrl=' + returnUrl + '&paymentModes=' + req.query.paymentModes;

		    //generate payment Token
		    let hash = crypto.createHmac('sha256', appSecret).update(queryString).digest('base64')

		    /* create parameters object to be sent 
		    ** to client side, with all the required
		    ** parameters to initiate Payment Transaction
			*/

		    let params = req.query;
		    params.paymentToken = hash;
		    params.appId = appId;
		    params.orderId = orderId;
            params.orderAmount = orderAmount;
            params.orderAmountUSD = orderAmountUSD;
            params.amountINR = amountINR;
            params.processingFeeINR = processingFeeINR;
            params.amountUSD = amountUSD;
            params.processingFeeUSD = processingFeeUSD;
            params.processingFeePercentage = processingFeePercentage;
            params.returnUrl = returnUrl;
            //URL to the service that will 
            //receive response from payment gateway 
            //with status of the transaction
            params.notifyUrl = 'https://' + req.headers.host + '/v1/payment/processResponse';

            console.log('\n\n\n'+params.notifyUrl+'\n\n\n')

	      	return ReS(res, {
	           params: params
	        }, 200);

	      })
	      .catch((err) => {
	      	console.log(err)
	      	return ReE(res, {success: false, error: 'Something went wrong while generating the payment token'}, 422);
	      });

	} catch(err) {
		console.log(err)
		return ReE(res, {success: false, error: 'Something went wrong while generating the payment token'}, 422);
	}
	
}

module.exports.getToken = getToken;

/*
* this service method is automaticaly called
* by payment gateway after a transaction
* gives status of transactions made by users
* when called, it updates the order details
* in system's database based on the response
* received from the payment gateway
*/
const processResponse = async function(req, res){
	
	try {
	  let data = req.body;

	  console.log("Receiving response from Payment Gateway for Order id: "+ data.orderId)

	  Orders.update({status: data.txStatus, message: data.txMsg, response: JSON.stringify(data)},{where: {
		id: data.orderId
	  }})
	    .then((order) => {
          return ReS(res, {
	           success: true, message: 'Order updated successfully'
	        }, 200);
	    })
	    .catch((err) => {
	    	console.log(err)
	      	return ReE(res, {success: false, error: 'Order not found'}, 422);
	    });

	} catch(err) {
		console.log(err)
		return ReE(res, {success: false, error: 'Something went wrong while generating the payment token'}, 422);
	}
	
}

module.exports.processResponse = processResponse;

const checkOrderStatus = async function(req, res){
  try {
    let orderId = parseInt(req.params.orderId);
    if (!orderId) {
      throw new Error('Order Id is not found');
    }
    // making sure that same order is accessing the order as the one
    // who created it
    Orders.find({where: {UserId: req.user.id, id: orderId}})
      .then((order) => {
      	return ReS(res, {
	           order: order
	        }, 200);
      })
      .catch((err) => {
    	console.log(err)
      	throw new Error('Order not found');
	   });
  } catch(err) {
	console.log(err)
	return ReE(res, {success: false, error: 'Something went wrong while checking the payment status'}, 422);
  }
}

module.exports.checkOrderStatus = checkOrderStatus;

