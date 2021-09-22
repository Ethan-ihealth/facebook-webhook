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
const { response } = require('express');

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
var result = {};
var smsBody = '';

//For Sms Service
var accountSid = 'ACebd49745fc5a61de2af1a43723d09465';
var authToken = '2d7b05b9b3d461d48c4903aed3f0c3fc'; 
var client = new twilio(accountSid, authToken);

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '<br/>' + retrieved_lead + '<br/>' + JSON.stringify(result) + '</pre>');
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
  field.map(data => {
    if(['full_name','email','phone_number'].includes(data.name)) {
      result = {...result, [data.name]:data.values}
    }
  })
}

const wordBeautify = (str) => {
  var res = str.replace(/[\"\[\]\{\}]/g,'')
  res = res.replace(/[\"\_]/g, ' ');
  res = res.replace(/[\"\,]/g, '\n');
  res = 'New User Info: \n' + res;
  return res;
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
  }
  
  if(received_updates) {
    received_updates.map(data => leadgen_id.unshift(data.entry[0].changes[0].value.leadgen_id))
  }
  
  // Retrieve user info based on lead ads id
  if(leadgen_id) {
    leadgen_id.map(leadId => new Promise((resolve, reject) => {
      //Using Set to deduplicate lead_id
        if(!setLeadId.has(leadId)) {
          setLeadId.add(leadId);
          request(`https://graph.facebook.com/v12.0/${leadId}?access_token=EAAIYgif4zcYBAHV5jgRyra1RtsLnuSHjikiRJPI31mrtyS9PKcmhT0ohqzv6WZC0KvjoZCw9SL0SM7Temq1mCX69ci6ZAXntDv5nSPesmqdeRQDl7hbHJuJV0RjatZBXDod8FCFg8PNxMim20A6xZANKepQoqJG58ooJXfFKdxfJqO2J9OL7OUQk9ZAA9Tm1j8HZApIULhJLZAH4Ckhe6XQlcExzdcS7PrUZD`,
          function(err, res, body) {
            if(err) {
              console.error('error:', err);
              reject(err)
            }
            if(response.statusCode != 200) {
              reject('Invalid status code <' + response.statusCode + '>');
            }
            retrieved_lead.unshift(body);
            getFieldHelper(JSON.parse(body))
            console.log('My App body:', body);
            smsBody = wordBeautify(JSON.stringify(result));
            resolve(body);
            if(body) {
              // Send sms to manager including the user info
              client.messages 
                .create({ 
                  body: smsBody,  
                  from: '+13346038848',
                  to: '+13123076745'
                }) 
                .then(message => console.log('Successfully send', message)) 
                .done();
            }  
          });
        }
      })
    );
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
