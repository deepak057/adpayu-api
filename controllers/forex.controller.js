const { Forex } = require('../models');
const https = require('https');


/*
* Fetch USD to INR forex rate and save it in the database
*/
const fetchForexRates =  async function(req, res){


https.get('https://api.exchangeratesapi.io/latest?symbols=INR&base=USD', (resp) => {
  let data = '';

  // A chunk of data has been recieved.
  resp.on('data', (chunk) => {
    data += chunk;
  });

  // The whole response has been received. 
  resp.on('end', () => {
    try {
      let json = JSON.parse(data);
      if (json.rates && 'INR' in json.rates) {
        Forex.find({where: {USD: 1}})
          .then((forex) => {
            if (forex) {
              forex.INR = json.rates.INR
              forex.save()
              console.log("Forex updated");
            } else {
              Forex.create({USD: 1, INR: json.rates.INR})
              console.log("Forex created");
            }
          })
        console.log("1 USD = " + json.rates.INR +" INR")
      }
      
    } catch (e) {
      console.log("Error while getting forex rates: "+e)
    }

  });

}).on("error", (err) => {
  console.log("Error while getting forex rates: " + err.message);
});

}
module.exports.fetchForexRates = fetchForexRates;
