var douban_movie = require("./lib/douban_movie.js");
var parse_file_list = require("./lib/parse_file_list");
var ReadWriteLock = require('rwlock');

var express = require('express');
var app = express();

app.use(express.static(__dirname + '/static'));

function fillMovieInfo (obj, minfo) {
    obj.year = minfo.year;
    obj.title = [minfo.title, minfo.original_title];
    obj.rating = minfo.rating.average;
    obj.genres = minfo.genres;
    obj.aka = minfo.aka;
}

app.get('/list.json', function (req, res) {
    try {
        var json = require("./list.json");
    } catch (err) {
        console.error("list.json not found!");
        res.json({});
        return;
    };

    var ret = new Object();
    var cb_lock = new ReadWriteLock();

    parse_file_list.getMovieFiles(json, [], function (err, fpath, finfo) {
        cb_lock.readLock ("L1", function (release) {
            if (err) {
                throw err;
            }
            else {
                parse_file_list.getMID(fpath, function (err, mid) {
                    if (err) {
                        mid = -1;
                    }
                    
                    var fi = {
                        path: fpath,
                        size: finfo.size,
                        time: finfo.time
                    };

                    if (ret[mid]) {
                        ret[mid].files.push(fi);
                    }
                    else {
                        ret[mid] = new Object();
                        ret[mid].files = [fi];
                    }

                    release();
                });
            }
        })
    });

    cb_lock.writeLock("L1", function (release) {
        for (var prop in ret) {
            if (ret.hasOwnProperty(prop)) {
                var mid = Number(prop);
                if (mid <= 0) {
                    ret[prop].api_success = false;
                    continue
                }

                {{{ ( function (mid) {
                cb_lock.readLock("L2", function (release) {
                    douban_movie.
                     getMovieInfoFromCache(mid, function (err, reply) {
                        if (err) {
                            ret[mid.toString()].api_success = false;
                        } else
                        {
                            ret[mid.toString()].api_success = true;
                            fillMovieInfo(ret[mid.toString()], reply);
                        }
                        release();
                    });
                });
                })(mid) }}}
            }
        }

        cb_lock.writeLock("L2", function (release) {
            res.json(ret);
            release();
        });

        release();
    });

});

var port = Number(process.argv[2]);
if (!(port >= 0 && port < 65536)) {
    port = 3000;
}

console.log("Listen at port " + port);
app.listen(port);
