var douban_movie = require("./lib/douban_movie.js");
var parse_file_list = require("./lib/parse_file_list");
var ReadWriteLock = require('rwlock');
var fs = require('fs');

var express = require('express');
var app = express();

var filelist_mtime = new Date(0);
var filelist = [];
var last_ret = new Object();

app.use(express.static(__dirname + '/static'));

function fillMovieInfo (obj, minfo) {
    obj.year = minfo.year;
    obj.title = [minfo.title, minfo.original_title];
    obj.rating = minfo.rating.average;
    obj.genres = minfo.genres;
    obj.aka = minfo.aka;
}

function loadFileList () {
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
    });
}

app.get('/list.json', function (req, res) {
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
                
                var fi = {path: fpath, size: finfo.size, time: finfo.time};

                if (ret[mid]) {
                    ret[mid].files.push(fi);
                }
                else {
                    ret[mid] = new Object();
                    ret[mid].files = [fi];
                }

                release();
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

        cb_lock.writeLock("L2", function (release) {
            res.json(ret);
            var end_time = (new Date()).getTime();
            console.log("Response time:", (end_time - start_time)/1000);
            last_ret = ret;
            release();
        });

        release();
    });
});


if (require.main === module) {

    var port = Number(process.argv[2]);

    if (!(port >= 0 && port < 65536)) {
        port = 3000;
    }

    loadFileList();

    console.log("Listen at port " + port);
    app.listen(port);
}

