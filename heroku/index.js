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
var retrieved_lead = {};
var leadgen_id = [];

//For Sms Service
var accountSid = 'ACebd49745fc5a61de2af1a43723d09465';
var authToken = '2d7b05b9b3d461d48c4903aed3f0c3fc'; 
var client = new twilio(accountSid, authToken);

app.get('/', function(req, res) {
  console.log(req);
  res.send('<pre>' + JSON.stringify(received_updates, null, 2) + '<br/>' + retrieved_lead + '</pre>');
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
  received_updates.map(data => leadgen_id.unshift(data.entry[0].changes[0].value.leadgen_id))
  request(`https://graph.facebook.com/v12.0/${leadgen_id[0]}?access_token=EAAIYgif4zcYBAFq7qvpETsD4TBnLb8EZBy9tBOin0Y3y3k9tF9a0blnxi8fTZAiZCjojrwaCch2nLJrKmWRJIZBtGAXRQPgOhtANHEzywyUCvbORd26JiWbjvVrrQgISXQPWuCIrWWbEX9jW6PfsH9B4zQORVHWyFz7Ai1D8xNNhiXDiMMD2zZAoMvgijeoWHM4dYLkEpjQfZAjMwfiUZB256ykZA1iepvwZD`,
    function(err, res, body) {
      console.error('error:', err);
      retrieved_lead = JSON.stringify(body, null, 2);
      console.log('body:', body);
  });
  // client.messages 
  //     .create({ 
  //        body: leadgen_id,  
  //        from: '+13346038848',
  //        to: '+13123076745' 
  //      }) 
  //     .then(message => console.log('Successfully send')) 
  //     .done();
  // res.sendStatus(200);
});

app.post('/instagram', function(req, res) {
  console.log('Instagram request body:');
  console.log(req.body);
  // Process the Instagram updates here
  received_updates.unshift(req.body);
  res.sendStatus(200);
});

app.listen();
