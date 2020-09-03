var express = require('express');
var app = express();
var Parser = require('rss-parser');
var parser = new Parser();
var request = require('request');
var url = require('url');
var Memcached = require('memcached');
var memcached = new Memcached('localhost:11211');
var week = 60 * 60 * 24 *7;
var defaultZip = 94110;
var MongoClient = require('mongodb').MongoClient;
var ipstackKey = process.env.IPSTACK_KEY

app.listen(8081, function() {
    console.log('Example app listening on port 8081');
});

app.get('/', function(req, res) {
    console.log('blah');
    res.send('Hello World!');
});

app.get('/feeds*', function(req,res) {
    console.log('getting feeds');
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    MongoClient.connect('mongodb://localhost:27017/', { useUnifiedTopology: true }, function(err, mongoConn) {
        var feed_name = url_parts.query['feed_name'];
        var mongoDB = mongoConn.db('platypus');
        mongoDB.collection('feeds').findOne({ name : feed_name }, function(err,feed) {
            var limit = parseInt(url_parts.query['num'])
            mongoDB.collection('feed_items').find( { feed_id : feed['_id']}).sort({ pub_ts: -1}).limit(limit).toArray(function(err,items) {
                var num_items = items.length;
                var ret_items = new Array(num_items);
                // fields = ['title','url'];
                fields = new Array();
                if (url_parts.query['fields'])
                    fields = url_parts.query['fields'].split(',');
                for (var i = 0; i < num_items; i++) {
                    if (fields.length > 0) {
                        ret_items[i] = {};
                        for (var j = 0; j < fields.length; j++) {
                            ret_items[i][fields[j]] = items[i][fields[j]];
                        }
                    } else {
                        ret_items[i] = items[i];
                    }
                }
                res.writeHead(200);
                res.write(JSON.stringify(ret_items));
                res.end();
            });
        });
    });
});

app.get('/weather*', function(req, res) {
    var url_parts = url.parse(req.url, true);
    var ip = getClientIp(req);
    var getZip = new Promise( (resolved, rejected) => {
        memcached.get(ip, function(err,zip) {
            if (zip) {
                resolved(zip);
            } else {
                request('http://api.ipstack.com/' + ip + '?access_key=' + ipstackKey, { json: true }, (err, res, body) => {
                    if (err) { return console.log(err); }
                    if (body.country_code == 'US') {
                        zip = body.zip;
                    } else {
                        zip = defaultZip;
                    }
                    if (!zip) { resolved(defaultZip); }
                    memcached.set(ip, zip, week, function(err) {
                        console.log(err);
                        console.log('caching zip');
                    });
                    resolved(zip);
                });
            }
        });
    });
    var weather;
    getZip.then( (zip) =>  {
        (async () => {
            console.log('finding weather for ' + zip);
            var feed = await parser.parseURL('http://www.rssweather.com/zipcode/' + zip + '/rss.php');
            console.log(feed.items[0]);
            res.send(feed.items[0]);
        })();
    });
});

// snippet taken from http://catapulty.tumblr.com/post/8303749793/heroku-and-node-js-how-to-get-the-client-ip-address
function getClientIp(req) {
  var ipAddress;
  // The request may be forwarded from local web server.
  var forwardedIpsStr = req.header('x-forwarded-for'); 
  if (forwardedIpsStr) {
    // 'x-forwarded-for' header may return multiple IP addresses in
    // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
    // the first one
    var forwardedIps = forwardedIpsStr.split(',');
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    // If request was not forwarded
    ipAddress = req.connection.remoteAddress;
  }
  console.log(ipAddress);
  // stripping crap at beginning
  ipAddress = ipAddress.replace('::ffff:','');
  console.log(ipAddress);
  return ipAddress;
};
