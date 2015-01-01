var API_BASE = "http://api.douban.com/v2/movie/";
var http = require('http');
var ReadWriteLock = require('rwlock');

var redis = require('redis');
var redis_client = redis.createClient();

var API_INT = 8000
var api_lock = new ReadWriteLock();
var cache_pending = [];

function hashMID (id) {
    return 'm_' + id.toString(32)
}

function searchMovie (keywords, callback) {
    api_lock.writeLock(function (release) {
        var url = API_BASE + "search?q=" + keywords.join(' ');
    
        last_api_fetch = (new Date()).getTime();

        http.get(url, function(res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                callback(null, JSON.parse(body));
            });
        }).on('error', function (err) {
            callback(err);
        });

        setTimeout(release, API_INT);
    });
}

function getMovieInfo (id, callback) {
    api_lock.writeLock(function (release) {
        var url = API_BASE + "subject/" + id;

        http.get(url, function(res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                callback(null, JSON.parse(body));
            });
        }).on('error', function (err) {
            callback(err);
        });

        setTimeout(release, API_INT);
    });
}

function cacheMovieInfoAPI (id) {
    getMovieInfo (id, function (err, json) {
        if (err) {
            console.error("Failed to fetch API of movie #" + id);
        }
        else {
            var json_str = JSON.stringify(json);
            redis_client.set(hashMID(id), json_str, function (err) {
                if (err) {
                    console.error("Failed to save API of movie #" + id);
                }
                else {
                    console.log("Saved API of movie #" + id);
                }
            });
        }
    });
}

function getMovieInfoFromCache (id, callback) {
    redis_client.get(hashMID(id), function (err, doc) {
        if (err) {
            throw err;
        }
        else if (doc === null) {
            if (cache_pending.indexOf(id) == -1) {
                cache_pending.push(id);

                setTimeout(function (id) {
                    cacheMovieInfoAPI(id);
                    cache_pending.pop(id);
                }, 0, id);
            };
                
            callback(":(", null);
        }
        else {
            callback(null, JSON.parse(doc));
        }
    });
}

exports.searchMovie = searchMovie
exports.getMovieInfo = getMovieInfo
exports.getMovieInfoFromCache = getMovieInfoFromCache

