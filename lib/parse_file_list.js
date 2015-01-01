var path = require('path');

var douban_movie = require("./douban_movie");

var redis = require('redis');
var redis_client = redis.createClient();
var cache_pending = [];

function hashPath (pa) {
    return 'p_' + path.join.apply(this, pa);
}

/* function getKeywords (s) {
    var bra_keys = s.match(/\[[^\[\]]*\]/);
    if (bra_keys) {
        var key = bra_keys[0].slice(1, -1);
        if (key.search(/[\u3400-\u9FBF]/) != -1) {
            return [key];
        }
    }

    var sl1 = s.search(/[. ](19\d\d|20[01]\d)((?!(19\d\d|20[01]\d)).)*$/);
    var sl2 = s.search(/[. ](720|1080)p\./);
    var keys;

    if (sl1 == -1) {
        keys = s.slice(0, sl2).split('.');
    } else if (sl2 == -1) {
        keys = s.slice(0, sl1).split('.');
    } else {
        var sl = sl1 > sl2 ? sl2 : sl1;
        keys = s.slice(0, sl1).split('.');
    }   

    for (i=0; i<keys.length; i++) {
        if (keys[i].search(/[\u3400-\u9FBF]/) != -1) {
            return [keys[i]];
        }
    }

    return keys
} */

function getKeywords (s) {
    var sp = /[. \[\]()\u3010\u3011]/;
    var badpat = [/(720|1080)p/, /blueray/, /[xh]264/, /hdtv/];
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
    ans.push(year.toString());

    return ans;
}

function getMovieFiles (fl, cd, callback, on_end) {
    fl.forEach(function (entry) {
        if (['directory', 'file'].indexOf(entry['type']) == -1) {
            return; 
        }

        ncd = cd.concat(path.normalize(entry['name']).replace(/\/$/, ''));
        ext = path.extname(entry['name']);
        
        if (entry['type'] === 'directory') {
            if (entry['name'].toLowerCase() != 'sample') {
                getMovieFiles(entry['contents'], ncd, callback);
            }
        }
        else if (entry['type'] === 'file') {
            video_exts = ['.avi', '.mkv']
        
            if (entry['size'] > 100*1024*1024 &&
                    entry['name'].toLowerCase().indexOf('sample') == -1 &&
                    video_exts.indexOf(ext) != '-1') {
                callback(null, ncd, entry);
            }
        }
    });
}

function cacheMID (pa) {
    var key = (pa[1].length - 4 <= pa[0].length) ? pa[0] : pa[1];
    var kw = getKeywords(key);

    douban_movie.searchMovie(kw, function (err, json) {
        if (err) {
            console.error("Failed to match get MID of file: " + db_key);
        }
        else {
            var mid = json['subjects'].length ?
                            Number(json['subjects'][0]['id']) : -1;
            
            redis_client.set(hashPath(pa), mid);
        }
    });
}

function getMID (patharr, callback) {
    var pa = patharr.slice(-2);
    var db_key = hashPath(pa);

    redis_client.get(db_key, function (err, doc) {
        if (err) {
            throw err;
        }
        else if (doc === null) {
            if (cache_pending.indexOf(db_key) == -1) {
                cache_pending.push(db_key);

                setTimeout(function (pa) {
                    cacheMID(pa);
                    cache_pending.pop(db_key);
                }, 0, pa);
            };
                
            callback(":(", null);
        }
        else {
            callback(null, Number(doc));
        }
    });
};

exports.getMovieFiles = getMovieFiles
exports.getKeywords = getKeywords
exports.getMID = getMID

function main (args) {
    json = require("./filelist.json");
    getMovieFiles(json, [], function (err, fpath, finfo) {
        if (err) {
            throw err;
        }
        else {
            console.log(fpath);
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
