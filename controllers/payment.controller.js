const { Orders, Forex } = require('../models');
const { to, ReE, ReS, isEmptyObject, uniqeFileName } = require('../services/util.service');
const Sequelize = require('sequelize');
var crypto = require('crypto');
require('dotenv').config();//instatiate environment variables

const Op = Sequelize.Op;


const getToken = async function(req, res){

	try {

		let err, forex, amountINR;
		
		/*
		* Get USD to INR forex rate
		*/
		[err, forex] = await to(Forex.getUSD2INR());
        if(err) return ReE(res, err, 422);

        /*
        * conver the given USD amount to INR
        * and round the figure upto two decimal places
        */
        amountINR = Math.round((req.query.orderAmount * forex) * 100) / 100

		/**
	    ** Keep track of this order
	    ** in system's database
	    **/

	    Orders.create({amount: amountINR})
	      .then ((order) => {
	      	
	        order.setUser(req.user);

		    //get CashFree payment gateway's secret credentials
			let appId = process.env.CASHFREE_APP_ID;
			let appSecret = process.env.CASHFREE_SECRET_KEY;

			//OrderId
			let orderId = order.id;
			
			/*
			* get the whole query string
			*/
		    let queryString;

		    //append AppId and OrderId to the above QueryString
		    queryString = 'appId='+ appId + '&orderId=' + orderId + '&orderAmount=' + amountINR + '&returnUrl=' + req.query.returnUrl + '&paymentModes=' + req.query.paymentModes;

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
            params.orderAmount = amountINR;
            params.orderAmountUSD = req.query.orderAmount;

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