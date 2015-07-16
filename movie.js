var douban_movie = require("./lib/douban_movie.js");
var omdb_movie = require("./lib/omdb_movie.js");
var parse_file_list = require("./lib/parse_file_list");
var ReadWriteLock = require('rwlock');
var fs = require('fs');

var compression = require("compression");
var express = require('express');
var app = express();

var filelist_mtime = new Date(0);
var filelist = [];
var last_ret = new Object();


function fillMovieInfo (obj, minfo) {
    obj.year = Number(minfo.year);
    obj.title = [minfo.title, minfo.original_title];
    //obj.rating = minfo.rating.average;
    obj.genres = minfo.genres;
    obj.aka = minfo.aka;
}


function loadFileList (callback) {
    fs.stat("list.json", function (err, stats) {
        if (err) {
            console.error("Cannot read list.json !");
            throw err;
        }

        if (stats.mtime - filelist_mtime == 0) {
            return;
        }

        try {
            var li = require('./list.json');
        } catch (e) {
            console.error("Cannot read list.json!");
            throw e;
        }

        var tmp = [];
        parse_file_list.getMovieFiles(li, [], function (err, p, info) {
            if (err) {
                throw err;
            }

            tmp.push([p, info]);
        });

        console.log("list.json reloaded!");
        filelist_mtime = stats.mtime;
        filelist = tmp;
        last_ret = new Object();

        callback && callback();
    });
}


        
function http_get_list_json (req, res) {
    var start_time = (new Date()).getTime();
    var ret = new Object();
    var cb_lock = new ReadWriteLock();

    process.nextTick(loadFileList);

    filelist.forEach(function (elem) {
        cb_lock.readLock ("L1", function (release) {
            var fpath = elem[0], finfo = elem[1];

            parse_file_list.getMID(fpath, function (err, mid) {
                if (err || !mid || mid == -1) {
                    release();
                    return;
                }
                
                var fi = {
                    path: fpath,
                    size: finfo.size,
                    time: finfo.time,
                    sub: finfo.sub
                };

                if (ret[mid]) {
                    ret[mid].files.push(fi);
                }
                else {
                    ret[mid] = new Object();
                    ret[mid].files = [fi];
                }


                douban_movie.getTTID(mid, function (err, ttid) {
                    if (!err) {
                        ret[mid].ttid = ttid;
                    }
                    release();
                });

            });
        });
    });

    cb_lock.writeLock("L1", function (release) {
        for (var prop in ret) {
            if (ret.hasOwnProperty(prop)) {
                var mid = Number(prop);

                if (last_ret[prop]) {
                    var fp = ret[prop].files;
                    ret[prop] = last_ret[prop];
                    ret[prop].files = fp;
                    continue;
                }

                {{{ ( function (mid) {
                cb_lock.readLock("L2", function (release) {
                    douban_movie.
                     getMovieInfoFromCache(mid, function (err, reply) {
                        if (err) {
                            delete ret[mid.toString()];
                        }
                        else{
                            fillMovieInfo(ret[mid.toString()], reply);
                        }
                        release();
                    });
                });
                })(mid) }}}
            }
        }
        release();
    });

    cb_lock.readLock("L1", function (release1) {
    cb_lock.writeLock("L2", function (release2) {
        for (var prop in ret) {
            if (ret.hasOwnProperty(prop) && !last_ret[prop] 
                                         && ret[prop].ttid) {
                var ttid = ret[prop].ttid;

                {{{ ( function (obj) {
                cb_lock.readLock("L3", function (release) {
                    omdb_movie.
                     getMovieInfoFromCache(obj.ttid, function (err, reply) {
                        if (!err) {
                            obj.rating = Number(reply.imdbRating);
                        }
                        release();
                    });
                });
                })(ret[prop]) }}}
            }
        }

        release1();
        release2();
    });});


    cb_lock.readLock("L1", function (release1) {
    cb_lock.readLock("L2", function (release2) {
    cb_lock.writeLock("L3", function (release3) {
        res && res.json(ret);
        var end_time = (new Date()).getTime();
        console.log("Response time:", (end_time - start_time)/1000);
        last_ret = ret;
        release1();
        release2();
        release3();
    });});});
};


app.use(express.static(__dirname + '/static'));
app.use(compression());
app.get('/list.json', http_get_list_json);


if (require.main === module) {

    var port = Number(process.argv[2]);

    if (!(port >= 0 && port < 65536)) {
        port = 3000;
    }

    loadFileList(http_get_list_json);

    console.log("Listen at port " + port);
    app.listen(port);
}

