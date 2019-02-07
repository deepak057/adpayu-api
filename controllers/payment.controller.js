const { Orders, Forex } = require('../models');
const { to, ReE, ReS, roundTwoDecimalPlaces } = require('../services/util.service');
const Sequelize = require('sequelize');
var crypto = require('crypto');
require('dotenv').config();//instatiate environment variables

const Op = Sequelize.Op;


const getToken = async function(req, res){

	try {

		let err, forex, amountINR, amountUSD = parseFloat(req.query.orderAmount), processingFeePercentage = 3, processingFeeINR, processingFeeUSD, orderAmount, orderAmountUSD;
		
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
			
			/*
			* create the whole query string based
			** on the supplied parameters
			*/
		    let queryString = 'appId='+ appId + '&orderId=' + orderId + '&orderAmount=' + orderAmount + '&returnUrl=' + req.query.returnUrl + '&paymentModes=' + req.query.paymentModes;

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
		    params.customerName = req.user.first + ' ' + req.user.last;
            params.customerPhone = '93949573653';
            params.customerEmail = req.user.email;
            params.orderAmount = orderAmount;
            params.orderAmountUSD = orderAmountUSD;
            params.amountINR = amountINR;
            params.processingFeeINR = processingFeeINR;
            params.amountUSD = amountUSD;
            params.processingFeeUSD = processingFeeUSD;
            params.processingFeePercentage = processingFeePercentage;

	      	return ReS(res, {
	           params: params
	        }, 200);

	      })
	      .catch((err) => {
	      	return ReE(res, {success: false, error: 'Something went wrong while generating the payment token'}, 422);
	      });

	} catch(err) {
		return ReE(res, {success: false, error: 'Something went wrong while generating the payment token'}, 422);
	}
	
}

module.exports.getToken = getToken;