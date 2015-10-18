var DBMOVIE_SUB = "http://movie.douban.com/subject/";

var all_movies = [];
var movie_data = [];
var entry_per_page = 50;
var autocomp = {
    name: [],
    genre: [],
};

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}

function humanFileSize (bytes) {
    var thresh = 1024;
    if (bytes < thresh) return bytes + ' B';
    var units = ['KiB','MiB','GiB','TiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(bytes >= thresh && u < units.length - 1);
    return bytes.toFixed(2) + ' ' + units[u];
};

function addRow (key) {
    var info = movie_data[key];

    var $table = $("#ml-table-body");
    var $row = $("<tr>", {
        id: 'm' + key,
    }).appendTo($table);

    // name column
    var $name_col = $("<td>").appendTo($row);
    var $zh_name = $("<a>", {
        class: "ml-title-zh",
        href: DBMOVIE_SUB + key,
        text: info.title[0],
    }).appendTo($name_col);

    if (info.title[0] != info.title[1])
        var $orig_name = $("<div>", {
            class: "ml-title-orig",
            text: info.title[1],
        }).appendTo($name_col);

    // year column
    $("<td>", {
        class: "ml-year",
        text: info.year > 1800 ? info.year : "",
    }).appendTo($row);

    // IMDB rating column
    var $rating_col = $("<td>").appendTo($row);
    var $rating = $("<a>", {
        class: "ml-rating",
        text: info.rating ? info.rating.toFixed(1) : "",
        href: "http://www.imdb.com/title/" + info.ttid,
    }).appendTo($rating_col);

    // genres column
    var $genres_col = $("<td>").appendTo($row);
    for (var genre of info.genres)
        $("<a>", {
            class: "label label-primary ml-genre",
            text: genre,
        }).click(function () {
            $("#searchtype").val("genre");
                $("#searchkey").val(genre);
            $('#searchbutton').click();
        }).appendTo($genres_col);

    // file info
    var $file_col = $("<td>").appendTo($row);
    var $file_brief = $("<span>", {
        class: "ml-file",
        data: { parent: key },
    }).click(function (e) {
        e.preventDefault();
        var key = $(this).data('parent');
        $("#f" + key).toggle();
    }).appendTo($file_col);

    var $filelist_row = $("<tr>", {
        class: "ml-filelist",
        id: 'f' + key,
    }).appendTo($table).append($("<td>文件信息</td>"));

    var $filelist_col = $("<td>", {
        colspan: 4,
    }).appendTo($filelist_row);

    var total_size = 0;
    var cd = [];
    for (var finfo of info.files) {
        var path = finfo.path;
        while (cd.length > 0 && cd[cd.length-1] != path[cd.length-1])
            cd.pop();

        for (var j=cd.length; j<path.length; j++) {
            var $dir = $("<div>")
                .text(path[j])
                .addClass("ml-filelist-dir")
                .css("margin-left", j+"em")
                .appendTo($filelist_col);
            cd.push(path[j]);
        }

        var info_str = humanFileSize(finfo.size) + ", " + finfo.time
                        + (finfo.sub ? (", " + finfo.sub) : "");
        var $info = $("<span>")
            .addClass("ml-filelist-info")
            .text(info_str)
            .appendTo($dir);

        cd.pop();
        total_size += finfo.size;
    }

    $file_brief
        .append(
            $("<span>").addClass("ml-file-number").text("" + info.files.length))
        .append("个文件")
        .append(
            $("<span>").addClass("ml-file-size").text(humanFileSize(total_size)));
}

function changePage (page) {
  var maxpage = $("#ml-table").data("maxpage");

  if (page >= maxpage || page < 0) {
    return;
  }

  var todisplay = all_movies.slice(page*entry_per_page, (page+1)*(entry_per_page));

  $("#ml-table").data("page", page);

  $("#ml-table-body").empty();
  todisplay.forEach(function (mid) {
      addRow(mid);
  });

  $("#current-page").text(page+1);
  $("#max-page").text(maxpage);
}

function setupPages () {
    var page_n = Math.ceil(all_movies.length / entry_per_page);
    $("#ml-table").data("maxpage", page_n > 0 ? page_n : 1);

    $("#page-select-menu").empty();
    for (var i=0; i<page_n; i++) {
        var button = $("<a>").attr("id","page"+i).text("第 "+(i+1)+" 页");
        $("#page-select-menu").append($("<li>").append(button));

        (function (page) {
            button.click(function () {changePage(page);});
        })(i);
    }

    changePage(0);
}

function showAllMovies () {
    all_movies = Object.getOwnPropertyNames(all_movies);
    setupPages();
}

function filterMovieByGenre (genre) {
    all_movies = [];
    $.each(movie_data, function (key, val) {
        if (val.genres.indexOf(genre) != -1)
            all_movies.push(key);
    });
    setupPages();
}

function filterMovieByPath (re) {
    all_movies = [];
    $.each(movie_data, function (key, val) {
        var found = false;
        val.files.forEach(function (elem) {
            var p = elem.path.join('/');
            if (p.search(re) != -1) {
                found = true;
                return false;
            }
        });
        found ? all_movies.push(key) : 0;
    });
    setupPages();
}

function filterMovieByTitle (title) {
    all_movies = [];
    $.each(movie_data, function (key, val) {
        var found = false;
        val.title.concat(val.aka).forEach(function (ele){
            if (ele.toLowerCase().search(title) != -1) {
                found = true;
                return false;
            }
        });
        found ? all_movies.push(key) : 0;
    });
    setupPages();
}

function sortMovieBy (sortby, reverse) {
    if (sortby == 'title')
        all_movies.sort(function (a, b) {
            return movie_data[a].title[0].localeCompare(movie_data[b].title[0], 'zh-Hans-CN');
        });
    else
        all_movies.sort(function (a, b) {
            var na = movie_data[a][sortby] ? Number(movie_data[a][sortby]) : 0;
            var nb = movie_data[b][sortby] ? Number(movie_data[b][sortby]) : 0;
            return na-nb;
        });

    reverse ? all_movies.reverse() : 0;
    changePage(0);
}

$(document).ready(function() {
    $.getJSON("/list.json", function (data) {
        movie_data = data;

        $.each(data, function (key, info) {
            info.title.forEach(function (e) {
                autocomp.name.indexOf(e) == -1 && autocomp.name.push(e);
            });
            info.genres.forEach(function (e) {
                autocomp.genre.indexOf(e) == -1 && autocomp.genre.push(e);
            });
            all_movies.push(key);
        });

        setupPages();

        // parse psudo get params
        var stype = getParameterByName("type");
        var skey = getParameterByName("type");
        if (stype && skey) {
            $("#search-type").val(getParameterByName("type"));
            $("#search-key").val(getParameterByName("key"));
            $("#search-btn").click();
        }

        $('#search-key').keypress(function(event) {
            if (event.keyCode == 13) {
                event.preventDefault();
                $('#searchbutton').click();
                return false;
            }
            else
                return true;
        }).autocomplete({
            source: function (request, response) {
                var key = request.term.toLowerCase();
                var src;

                if ($('#searchtype').val() == "title")
                    src = autocomp.name;
                else if ($('#searchtype').val() == "genre")
                    src = autocomp.genre;
                else
                    return;

                response($.grep(src, function (s) {
                    return s.toLowerCase().indexOf(key) != -1;
                }));
            },
        });
    });

    $('body').on('click', '.unsorted', function() {
        var sortby = $(this).data("sortby");

        $('.sortdown, .sortup').addClass('unsorted');
        $('.sortdown').removeClass('sortdown');
        $('.sortup').removeClass('sortup');

        $(this).removeClass('unsorted');
        $(this).addClass('sortdown');

        sortMovieBy(sortby);
    });

    $('body').on('click', '.sortdown', function() {
        var sortby = $(this).data("sortby");
        $(this).removeClass('sortdown');
        $(this).addClass('sortup');
        sortMovieBy(sortby, true);
    });

    $('body').on('click', '.sortup', function() {
        var sortby = $(this).data("sortby");
        $(this).removeClass('sortup');
        $(this).addClass('sortdown');
        sortMovieBy(sortby);
    });

    $('#first-page').click(function () {changePage(0);});
    $('#last-page').click(function () {changePage($("#ml-table").data("maxpage")-1)});
    $('#prev-page').click(function () {changePage($("#ml-table").data("page")-1)});
    $('#next-page').click(function () {changePage($("#ml-table").data("page")+1)});
});

function search() {
    var type = $("#search-type").val();
    var keyword = $("#search-key").val();

    if (type == 'title')
      filterMovieByTitle(keyword);
    else if (type == 'genre')
      filterMovieByGenre(keyword);
    else if (type == 'path')
      filterMovieByPath(new RegExp(keyword, "i"));

    window.history.pushState(
        null, null,
        window.location.pathname + "?type=" + type + "&key=" + keyword);
}

function reset() {
    $("#searchkey").val("");
    showAllMovies();
    window.history.pushState(null, null, window.location.pathname);
}
