var path = require('path');
var minimatch = require("minimatch");

var douban_movie = require("./douban_movie");

var redis = require('redis');
var redis_client = redis.createClient();
var cache_pending = [];
var cache_override = [];

function hashPath (pa) {
    return 'p_' + path.join.apply(this, pa);
}

function getKeywords (s) {
    var sp = /[. \[\]()\u3010\u3011]/;
    var badpat = [/(720|1080)p/i, /blueray/i, /[xh]264/i, /hdtv/i];
    var kw = s.split(sp);
    var end = kw.length;
    var year;

    for (var i=0; i<kw.length; i++) {
        if (kw[i].search(/[\u3400-\u9FBF]/) != -1) {
            return [kw[i]];
        }
    }

    for (var i=kw.length-1; i>=1; i--) {
        var yr = Number(kw[i]);
        if (yr > 1900 && yr < 2018) {
            end = i;
            year = yr;
            break;
        }
    }

    for (var i=0; i<end; i++) {
        for (var j=0; j<badpat.length; j++) {
            if (kw[i].search(badpat[j]) != -1) {
                end = i;
                break;
            }
        }
    }

    var ans = kw.slice(0, end ? end : 1);
    ans.length == 1 && year ? ans.push(year.toString()) : 0;

    return ans;
}

function getMovieFiles (fl, cd, callback) {
    var subtitles = [], videos = [];
    fl.forEach(function (entry) {
        if (['directory', 'file'].indexOf(entry['type']) == -1 ||
            entry['name'].toLowerCase().indexOf('sample') != -1) {
            return; 
        }

        var ncd = cd.concat(path.normalize(entry['name']).replace(/\/$/, ''));
        
        if (entry['type'] === 'directory') {
            if (entry['name'].toLowerCase() != 'sample') {
                getMovieFiles(entry['contents'], ncd, callback);
            }
        }
        else if (entry['type'] === 'file') {
            var ext = path.extname(entry['name']);
            var video_exts = ['.avi', '.mkv', '.ts', '.mp4'];
            var subtitle_exts = ['.srt', '.ass', '.ssa'];
        
            if (entry['size'] > 104857600 && video_exts.indexOf(ext) > -1) {
                videos.push({ ncd: ncd, info: entry })
            }
            else if (subtitle_exts.indexOf(ext) > -1) {
                subtitles.push(entry['name']);
            }
        }
    });
    
    videos.forEach( function (entry) {
        var base = entry.info['name'].replace(/\.[^.]+/, '');
        for (var i=0; i<subtitles.length; i++) {
            if (subtitles[i].indexOf(base) == 0) {
                entry.info['sub'] = path.extname(subtitles[i])
                                        .slice(1)
                                        .toUpperCase();
                subtitles.splice(i, 1);
                break;
            }
        }
        callback(null, entry.ncd, entry.info);
    } );
}

function cacheMID (pa, callback) {
    if (pa[0].search(/(19|20)\d\d-(19|20)[01]\d/) != -1) {
        var key = pa[1];
    }
    else {
        var key = (pa[1].length - 5 <= pa[0].length) ? pa[0] : pa[1];
    }

    var kw = getKeywords(key);
    var hash = hashPath(pa);

    douban_movie.searchMovie(kw, function (err, json) {
        if (err || !json || json.msg) {
            callback && callback(err ? err : json.msg);
            console.error("Failed to match get MID of file: " + hash);
        }
        else {
            // if not found, set mid to -1
            var mid = json['subjects'].length ?
                            Number(json['subjects'][0]['id']) : -1;

            callback && callback(null, mid);
            console.log("Recorded MID: " + hash);
            redis_client.set(hash, mid);
        }
    });
}

function addOverrides (glob, mid, callback) {
    redis_client.rpush("override", mid + "_" + glob, function (err) {
        if (err) {
            throw err;
        } else {
            callback && callback();
            getOverrides();  // to refresh cache
        }
    });
}

function getOverrides (callback) {
    redis_client.lrange("override", 0, -1, function (err, rules) {
        if (err) {
            throw err;
        } else {
            cache_override = rules;
            var result = []

            rules.forEach(function (rule) {
                var sep = rule.indexOf("_");

                if (sep >= 0) {
                    var mid = parseInt(rule.slice(0, sep));
                    var glob = rule.slice(sep+1);

                    if (!isNaN(mid) && glob.length > 0) {
                        result.push({
                            glob: glob,
                            mid: mid
                        });
                    }
                }
            });

            callback && callback(result);
        }
    });
}


function getMID (patharr, callback) {
    var full_path = "/" + patharr.join("/");
    var pa = patharr.slice(-2);
    var db_key = hashPath(pa);

    for (var i=0; i<cache_override.length; i++) {
        var rule = cache_override[i];
        var sep = rule.indexOf("_");
        var mid = parseInt(rule.slice(0, sep));
        var glob = rule.slice(sep+1);

        if (!glob.startsWith("/")) {
            glob = "**/" + glob;
        }

        if (minimatch(full_path, glob)) {
            callback && callback(null, mid);
            return;
        }
    }

    redis_client.get(db_key, function (err, doc) {
        if (err) {
            throw err;
        } else if (doc === null) {
            callback && callback(":(", null);

            if (cache_pending.indexOf(db_key) == -1) {
                cache_pending.push(db_key);

                setTimeout(function (pa) {
                    cacheMID(pa, function (err, mid) {
                        if (err || mid == -1) return;
                        // cache movie info as well
                        setTimeout(
                            douban_movie.getMovieInfoFromCache,
                            Math.round(Math.random()) * 1000, mid);
                        cache_pending.pop(hashPath(pa));
                    });
                }, 0, pa);
            };
        }
        else {
            callback && callback(null, Number(doc));
        }
    });
};

exports.getMovieFiles = getMovieFiles
exports.getKeywords = getKeywords
exports.addOverrides = addOverrides
exports.getOverrides = getOverrides
exports.getMID = getMID

function main (args) {
    json = require("../list.json");
    getMovieFiles(json, [], function (err, fpath, finfo) {
        if (err) {
            throw err;
        }
        else {
            //console.log(fpath);
            //console.log(getKeywords(fpath[fpath.length-2]));
            //console.log(finfo);
            getMID(fpath, function (err, mid) {
                if (err) {
                    console.error("[UPSET] " + err)
                }
                else {
                    console.log("[HAPPY] " + mid)
                }
            });
        }
    });
}

if (require.main === module) {
    main(process.argv.slice(2));
}
