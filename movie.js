"use strict";

if (typeof Promise == 'undefined') {
    var Promise = require('promise');
}

var douban_movie = require("./lib/douban_movie.js");
var omdb_movie = require("./lib/omdb_movie.js");
var parse_file_list = require("./lib/parse_file_list");
var fs = require('fs');

var compression = require("compression");
var express = require('express');
var app = express();

function fillMovieInfo (obj, minfo) {
    obj.year = Number(minfo.year);
    obj.title = [minfo.title, minfo.original_title];
    //obj.rating = minfo.rating.average;
    obj.genres = minfo.genres;
    obj.aka = minfo.aka;
}


function MovieFileListLoader() {
    this.movie_files = [];
    this.mtime = new Date(0);
}

MovieFileListLoader.prototype.load_json = function (path, callback) {
    var that = this;
    fs.stat(path, function (err, stats) {
        if (err) {
            console.error("Cannot open list.json!");
            callback(err);
            return;
        }

        if (stats.mtime - that.mtime == 0) {
            callback && callback(null, that.movie_files, false);
            return;
        }

        try {
            var list = JSON.parse(fs.readFileSync('./list.json', 'utf8'));
        }
        catch (e) {
            console.error("Cannot open list.json!");
            callback && callback(e);
            return;
        }

        var movie_files = [], success = true;
        parse_file_list.getMovieFiles(list, [], function (err, p, info) {
            if (err) {
                console.error("Failed to parse list.json!");
                callback && callback(err);
                success = false;
            }
            else {
                movie_files.push([p, info]);
            }
        });

        if (success) {
            that.mtime = stats.mtime;
            that.movie_files = movie_files
            callback && callback(null, movie_files, true);
            console.log("list.json reloaded!");
        }
    });
}

var file_list_loader = new MovieFileListLoader();
var last_reply = new Object();

function http_get_list_json (req, res) {
    var start_time = (new Date()).getTime();

    file_list_loader.load_json("list.json", function (err, list, updated) {
        var futures = [];
        var reply = new Object();

        if (updated) {
            last_reply = new Object();
        }

        list.forEach(function (elem) {
            var promise = new Promise(function (global_resolve) {
                var fpath = elem[0], finfo = elem[1];
                parse_file_list.getMID(fpath, function (err, mid) {
                    if (err || !(mid > 0)) {
                        global_resolve();
                        return;
                    }

                    if (reply.hasOwnProperty(mid)) {
                        global_resolve();
                    }
                    else
                    {
                        reply[mid] = last_reply.hasOwnProperty(mid) ? last_reply[mid] : new Object();
                        reply[mid].files = [];

                        var promise = Promise.resolve(reply[mid])
                        .then(function (r) {
                            return new Promise(function (resolve, reject) {
                                if (!r.title) {
                                    douban_movie.getMovieInfoFromCache(mid, function (err, info) {
                                        if (!err && info) {
                                            r.year = Number(info.year);
                                            r.title = [info.title, info.original_title];
                                            // r.rating = info.rating.average;
                                            r.genres = info.genres;
                                            r.aka = info.aka;
                                        }
                                        resolve(r);
                                    });
                                }
                                else {
                                    resolve(r);
                                }
                            });
                        })
                        .then(function (r) {
                            return new Promise(function (resolve, reject) {
                                if (!r.ttid) {
                                    douban_movie.getTTID(mid, function (err, ttid) {
                                        if (!err && ttid) {
                                            r.ttid = ttid;
                                        }
                                        resolve(r);
                                    });
                                }
                                else {
                                    resolve(r);
                                }
                            });
                        })
                        .then(function (r) {
                            return new Promise(function (resolve, reject) {
                                if (!r.rating && r.ttid) {
                                  omdb_movie.getMovieInfoFromCache(r.ttid, function (err, info) {
                                      !err && (r.rating = Number(info.imdbRating));
                                      resolve(r);
                                  });
                                }
                                else {
                                    resolve(r);
                                }
                            });
                        })
                        .then(function (r) {
                            global_resolve();
                        });
                    }

                    reply[mid].files.push({
                        path: fpath,
                        size: finfo.size,
                        time: finfo.time,
                        sub: finfo.sub,
                    });
                });
            });

            futures.push(promise);
        });

        Promise.all(futures).then(function () {
            for (var i in reply) {
                if (!reply[i].title || !reply[i].title[0]) {
                    delete reply[i];
                }
            }
            res && res.json(reply);
            var end_time = (new Date()).getTime();
            console.log("Response time:", (end_time - start_time)/1000);
            last_reply = reply;
        });
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

    file_list_loader.load_json("list.json");
    http_get_list_json();

    console.log("Listen at port " + port);
    app.listen(port);
}
