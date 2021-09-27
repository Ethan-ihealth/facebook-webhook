/**
 * Copyright 2016-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the
 * LICENSE file in the root directory of this source tree.
 */

var bodyParser = require('body-parser');
var express = require('express');
var app = express();
var xhub = require('express-x-hub');
var twilio = require('twilio');
var request = require('request');
 
app.set('port', (process.env.PORT || 5000));
app.listen(app.get('port'));

app.use(xhub({ algorithm: 'sha1', secret: process.env.APP_SECRET }));
app.use(bodyParser.json());

var token = process.env.TOKEN || 'token';
var received_updates = [];
var retrieved_lead = [];
var leadgen_id = [];
var setLeadId = new Set();
var setLeadAd = new Set();
var longLivedUserToken = '';

//For Sms Service
var accountSid = 'ACebd49745fc5a61de2af1a43723d09465';
var authToken = '2d7b05b9b3d461d48c4903aed3f0c3fc'; 
var client = new twilio(accountSid, authToken);

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '<br/>' + longLivedUserToken + '<br/>' + retrieved_lead + '</pre>');
});

app.get(['/facebook', '/instagram'], function(req, res) {
  if (
    req.query['hub.mode'] == 'subscribe' &&
    req.query['hub.verify_token'] == token
  ) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(400);
  }
});

const getFieldHelper = (body) => {
  const field = body.field_data || [];
  var obj = {};
  field.map(data => {
    if(['full_name','email','phone_number', 'company_name'].includes(data.name)) {
      obj = {...obj, [data.name]:data.values}
    }
  })
  return obj;
}

const wordBeautify = (str) => {
  var res = str.replace(/[\"\[\]\{\}]/g,'')
  res = res.replace(/[\"\_]/g, ' ');
  res = res.replace(/[\"\,]/g, '\n');
  res = 'Potential User Info: \n' + res;
  return res;
}

const generateLongTimeToken = () => {
  return new Promise((resolve, reject) => {
    request(`https://graph.facebook.com/v12.0/oauth/access_token?grant_type=fb_exchange_token&client_id=589897248853446&client_secret=57c8d239d63ce762c84e4f7437f1a59a&fb_exchange_token=EAAIYgif4zcYBACZCZBxcQDPlcjvLIC9TZCSf4o10kch0YZB2vPBK38g53u8MiqAm6lwEoNfGazmQsbv8xDuBpLsHCsaRfeNT62noD1FHkAm2Mj8IVfO0T5rEncKYoAyvx2CiGMnkV94elQmYUu73CqImUqpvZApLxRrfovtcCrvui61K4oP19N8UKujWQZAC4ZD`,
    function(err, res, body) {
      if(err) {
        console.error('Get Long Token Error:', err, '\nBody', body);
        reject(err);
      } else if(res.statusCode != 200) {
        console.error('Get Long Token Invalid status code <' + res.statusCode + '>', '\nBody', body);
      } else {
        let obj = JSON.parse(body);
        longLivedUserToken = obj.access_token || "";
        resolve(body);
      }
    });
  }) 
}

//Get Long time token when deploying
if(!longLivedUserToken) {
  generateLongTimeToken()
}

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');

  // Process the Facebook updates here
  // Deduplicate same lead ad
  if(!setLeadAd.has(req.body)) {
    setLeadAd.add(req.body);
    received_updates.unshift(req.body);
    // let number = ['+13123076745']
    // let sms = "New Webhook Lead Event: " + req.body;
    // number.forEach(async num => {
    //   if(sms) {
    //     // Send sms to manager including the user info
    //     await client.messages 
    //       .create({ 
    //         body: sms,  
    //         from: '+13346038848',
    //         to: num
    //       }) 
    //       .then(message => console.log('Successfully send many ppl', message)) 
    //       .done();
    //   }  
    // })
  }
  
  if(received_updates) {
    received_updates.map(data => leadgen_id.unshift(data.entry[0].changes[0].value.leadgen_id))
  }
  
  // Retrieve user info based on lead ads id
  if(leadgen_id) {
    leadgen_id.map(leadId => {
      //Using Set to deduplicate lead_id
      if(!setLeadId.has(leadId)) {
        setLeadId.add(leadId);
        request(`https://graph.facebook.com/v12.0/${leadId}?access_token=EAAIYgif4zcYBANrAlyTlUHmYijRh6H5VSZCM8HWZAPVVp5fByVinSvKDg7TSF1areTFGlCtlpbmHNZB2A62VoeQwUAREm4H5WNp9g0pJf2Rmc5lXNJmOxBxi4XSpVS2X4vpOcaJTpCiUKgkRrH3WjzkpHs1Xugu3G53lMgMHIXlZA2e5yZBb6nSz34u9m6Pi7DyZAn4F7AqQZDZD`,
        function(err, res, body) {
          if(err) {
            console.error('Retrieving Error:', err, '\nBody', body);
          } else if(res.statusCode != 200) {
            console.error('Retrieving Invalid status code <' + res.statusCode + '>', '\nBody', body);
          } else {
            console.log('My App body!!:', body);
            retrieved_lead.unshift(body);
            let obj = getFieldHelper(JSON.parse(body))
            let sms = wordBeautify(JSON.stringify(obj));
            let number = ['+13123076745']
            number.forEach(async num => {
              if(sms) {
                // Send sms to manager including the user info
                await client.messages 
                  .create({ 
                    body: sms,  
                    from: '+13346038848',
                    to: num
                  }) 
                  .then(message => console.log('Successfully send many ppl', message)) 
                  .done();
              }  
            })
          }
        });
      }
    });
  }
  res.sendStatus(200);
});
 
app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});
 
app.listen();
 