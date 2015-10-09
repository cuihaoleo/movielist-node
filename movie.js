"use strict";

var douban_movie = require("./lib/douban_movie.js");
var omdb_movie = require("./lib/omdb_movie.js");
var parse_file_list = require("./lib/parse_file_list");
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

    process.nextTick(loadFileList);

    // search and get MovieID from Douban
    function task_group1() {
        var futures = []

        for (let elem of filelist) {
            futures.push(new Promise(function(resolve, reject) {
                var fpath = elem[0], finfo = elem[1];

                parse_file_list.getMID(fpath, function (err, mid) {
                    if (err || !(mid > 0)) {
                        resolve();
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
                        resolve(mid);
                    });
                });
            }));
        }

        return futures;
    }

    // get movie info from Douban (and get its IMDB ID)
    function task_group2() {
        var futures = [];

        for (let prop of Object.getOwnPropertyNames(ret)) {
            var mid = Number(prop);

            if (last_ret[prop]) {
                var fp = ret[prop].files;
                ret[prop] = last_ret[prop];
                ret[prop].files = fp;
                continue;
            }

            futures.push((function (mid) {
                return new Promise(function (resolve, reject) {
                    douban_movie.
                    getMovieInfoFromCache(mid, function (err, reply) {
                        if (err) {
                            delete ret[mid.toString()];
                        }
                        else{
                            fillMovieInfo(ret[mid.toString()], reply);
                        }
                        resolve();
                    });
                });
            })(mid));
        }

        return futures;
    }

    // get movie info from OMDB
    function task_group3() {
        var futures = [];
        for (let prop of Object.getOwnPropertyNames(ret)) {
            var ttid = ret[prop].ttid;

            futures.push((function (obj) {
                return new Promise(function (resolve, reject) {
                    omdb_movie.
                    getMovieInfoFromCache(obj.ttid, function (err, reply) {
                        !err && (obj.rating = Number(reply.imdbRating));
                        resolve();
                    });
                });
            })(ret[prop]));
        }
        return futures;
    }

    Promise.resolve()
    .then(() => Promise.all(task_group1()))
    .then(() => Promise.all(task_group2()))
    .then(() => Promise.all(task_group3()))
    .then(function () {
        res && res.json(ret);
        var end_time = (new Date()).getTime();
        console.log("Response time:", (end_time - start_time)/1000);
        last_ret = ret;
    });
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

