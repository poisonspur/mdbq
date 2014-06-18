var http = require('http')

var server = http.createServer().listen(8080, 'localhost');
var MongoClient = require('mongodb').MongoClient;

server.on('request', function(req,res) {
    var url = require('url');
    var url_parts = url.parse(req.url, true);
    MongoClient.connect('mongodb://localhost:27017/platypus/', function(err, db) {
        var feed_name = url_parts.query['feed_name'];
        db.collection('feeds').findOne({ name : feed_name }, function(err,feed) {
            var limit = parseInt(url_parts.query['num'])
            db.collection('feed_items').find(
                { $query : { feed_id : feed['_id']}, 
                  $orderby : { pub_ts : -1} } 
                ).limit(limit).toArray(function(err,items) {
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

