var API_BASE = "http://api.douban.com/v2/movie/";
var WEB_BASE = "http://movie.douban.com/subject/";
var http = require('http');
var ReadWriteLock = require('rwlock');

var redis = require('redis');
var redis_client = redis.createClient();

var api_lock = new ReadWriteLock();
var lock_count1 = 0;
var lock_count2 = 0;
var cache_pending = [];

function hashMID (id, prefix) {
    return (prefix ? prefix + '_' : 'm_') + id.toString(32);
}

function API_INT () {
    return 12000 + Math.round(Math.random()) * 2000;
}

function searchMovie (keywords, callback) {
    api_lock.writeLock("A1", function (release) {
        var url = API_BASE + "search?q=" + keywords.join(' ');
    
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

function getMovieInfo (id, callback) {
    api_lock.writeLock("A2", function (release) {
        var url = API_BASE + "subject/" + id;

        http.get(url, function(res) {
            var body = '';

            res.on('data', function (chunk) {
                body += chunk;
            });

            res.on('end', function () {
                callback && callback(null, JSON.parse(body));
            });
        }).on('error', function (err) {
            callback && callback(err);
        });

        setTimeout(release, API_INT());
    });
}

function cacheMovieInfoAPI (id, callback) {
    getMovieInfo (id, function (err, json) {
        if (err) {
            callback && callback(err);
            console.error("Failed to fetch API of movie #" + id);
        }
        else {
            callback && callback(null, json);
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
                    cacheMovieInfoAPI(id, function (err, reply) {
                        cache_pending.pop(id);
                    });
                }, 0, id);
            };
                
            callback && callback(":(", null);
        }
        else {
            callback && callback(null, JSON.parse(doc));
        }
    });
}

function cacheTTID (mid, callback) {
    var url = WEB_BASE + mid + "/";

    http.get(url, function(res) {
        var body = '';

        res.on('data', function (chunk) {
            body += chunk;
        });

        res.on('end', function () {
            parsed = body.match(/http:\/\/www\.imdb\.com\/title\/(tt\d*)/);
            if (parsed) {
                ttid = parsed[1];
                callback && callback(null, ttid);
            }
            else {
                callback("TTID for " + mid + " not found.");
                return;
            }

            redis_client.set(hashMID(mid, "i"), ttid, function (err) {
                if (err) {
                    console.error("Failed to save TTID of movie #" + mid);
                }
                else {
                    console.log("Saved TTID of movie #" + mid);
                }
            });
        });
    }).on('error', function (err) {
        callback && callback(err);
    });
}

function getTTID (mid, callback) {
    var db_key = hashMID(mid, "i");

    redis_client.get(db_key, function (err, doc) {
        if (err) {
            throw err;
        }
        else if (doc === null) {
            if (cache_pending.indexOf(db_key) == -1) {
                cache_pending.push(db_key);

                setTimeout(function (mid, db_key) {
                    cacheTTID(mid, function (err, reply) {
                        cache_pending.pop(hashMID(mid, "i"));
                    });
                }, 0, mid);
            };
                
            callback && callback(":(", null);
        }
        else {
            callback && callback(null, doc);
        }
    });

}

exports.searchMovie = searchMovie
exports.getMovieInfo = getMovieInfo
exports.getMovieInfoFromCache = getMovieInfoFromCache
exports.getTTID = getTTID

