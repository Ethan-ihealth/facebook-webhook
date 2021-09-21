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

//For Sms Service
var accountSid = 'ACebd49745fc5a61de2af1a43723d09465';
var authToken = '2d7b05b9b3d461d48c4903aed3f0c3fc'; 
var client = new twilio(accountSid, authToken);

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '<br/>' + JSON.stringify(retrieved_lead) + '</pre>');
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

app.post('/facebook', function(req, res) {
  console.log('Facebook request body:', req.body);

  if (!req.isXHubValid()) {
    console.log('Warning - request header X-Hub-Signature not present or invalid');
    res.sendStatus(401);
    return;
  }

  console.log('request header X-Hub-Signature validated');
  // Process the Facebook updates here
  received_updates.unshift(req.body);
  if(received_updates) {
    received_updates.map(data => leadgen_id.unshift(data.entry[0].changes[0].value.leadgen_id))
  }
  
  // Retrieve user info based on lead ads id
  if(leadgen_id) {
    leadgen_id.map(leadId => {
      request(`https://graph.facebook.com/v12.0/${leadId}?access_token=EAAIYgif4zcYBABfQrsRleDMWWT2ZCtLA0r9Rn0KWJbHz9xIJOFNZAZAnB9XBjN1MvnEtZA8tzaouM3cfPf1bfZBh6hJauW6fNAviwhK7D5zVPbAdFQ4FA1B7jeODtYhZCZCPtYmYaEHeDZBymAFw1cxaZB4JypDPZBNY38BNCDmG5AZBR4HBITOn8hzKMq7JLUSk9IQXxLpLxYTCE0uyX8BUXYBQa9NdmXdCq4ZD`,
      function(err, res, body) {
        console.error('error:', err);
        retrieved_lead.unshift(body);
        console.log('body:', body);
      });
    });
  }

  // Send sms to manager including the user info
  if(received_lead) {
    client.messages 
      .create({ 
         body: retrieved_lead,  
         from: '+13346038848',
         to: '+13123076745' 
       }) 
      .then(message => console.log('Successfully send')) 
      .done();
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
