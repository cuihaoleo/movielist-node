var API_BASE = "http://www.omdbapi.com/";
var http = require('http');
var ReadWriteLock = require('rwlock');

var redis = require('redis');
var redis_client = redis.createClient();

var api_lock = new ReadWriteLock();
var lock_count1 = 0;
var lock_count2 = 0;
var cache_pending = [];

function hashTTID (ttid) {
    return ttid;
}

function API_INT () {
    return 12000 + Math.round(Math.random()) * 2000;
}

function getMovieInfo (ttid, callback) {
    api_lock.writeLock("I2", function (release) {
        var url = API_BASE + "?i=" + ttid;

        http.get(url, function(res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                var success = true;
                
                try {
                    parsed = JSON.parse(body);
                }
                catch (err) {
                    success = false;
                    callback && callback(err);
                }
                success && callback && callback(null, parsed);
            });
        }).on('error', function (err) {
            callback && callback(err);
        });

        setTimeout(release, API_INT());
    });
}

function cacheMovieInfoAPI (ttid, callback) {
    getMovieInfo (ttid, function (err, json) {
        if (err) {
            callback && callback(err);
            console.error("Failed to fetch OMDB API of " + ttid);
        }
        else {
            callback && callback(null, json);
            var json_str = JSON.stringify(json);
            redis_client.set(hashTTID(ttid), json_str, function (err) {
                if (err) {
                    console.error("Failed to save OMDB API of " + ttid);
                }
                else {
                    console.log("Saved OMDB API of " + ttid);
                }
            });
        }
    });
}

function getMovieInfoFromCache (ttid, callback) {
    redis_client.get(hashTTID(ttid), function (err, doc) {
        if (err) {
            throw err;
        }
        else if (doc === null) {
            callback && callback(":(", null);

            if (cache_pending.indexOf(ttid) == -1) {
                cache_pending.push(ttid);

                setTimeout(function (ttid) {
                    cacheMovieInfoAPI(ttid, function (err, reply) {
                        cache_pending.pop(ttid);
                    });
                }, 0, ttid);
            };
        }
        else {
            callback && callback(null, JSON.parse(doc));
        }
    });
}

exports.getMovieInfo = getMovieInfo
exports.getMovieInfoFromCache = getMovieInfoFromCache

