var DBMOVIE_SUB = "http://movie.douban.com/subject/";

var all_movies = [];
var movie_data = [];
var entry_per_page = 50;

var autocomp_name = [];
var autocomp_genre = [];

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
  var val = movie_data[key];
  var this_row = $("<tr>").attr('id', 'm'+key);
  $("#movie-table-body").append(this_row);

  // movie title
  var name_col = $("<td>");
  this_row.append(name_col);

  var zh_name_a = $("<a>").addClass("zh-title").attr(
                  'href', DBMOVIE_SUB + key).text(val.title[0]);
  name_col.append(zh_name_a);

  if (val.title[0] != val.title[1]) {
    var orig_name_div = $("<div>").addClass("orig-title").text(val.title[1]);
    name_col.append(orig_name_div);
  }

  // year
  this_row.append($("<td>").addClass("mv-year").text(
    val.year > 1800 ? val.year : ""
  ));

  // rating
  var rating_col = $("<td>");
  var rating_div = $("<div>").addClass("mv-rating").text(val.rating.toFixed(1));
  rating_col.append(rating_div);
  this_row.append(rating_col);

  // genres
  var genres_col = $("<td>");
  val.genres.forEach(function (genre) {
    var genre_span = $("<a>").addClass("label label-primary mv-genre");
    genre_span.text(genre);
    genres_col.append(genre_span);
    genre_span.click(function () {
      $("#searchtype").val("genre");
      $("#searchkey").val(genre);
      $('#searchbutton').click();
    });
  });
  this_row.append(genres_col);

  // file info
  var files_col = $("<td>");
  var cd = [];
  for (var i=0; i<val.files.length; i++) {
    var cpath = val.files[i].path;
    while (cd.length &&
          (cd.length > cpath.length || cd[cd.length-1] != cpath[cd.length-1])) {
      cd.pop();
    }

    for (var j=cd.length; j<cpath.length; j++)
    {
      cd.push(cpath[j]);
      var fp_div = $("<div>").addClass("plevel").css("margin-left", j + "em");
      fp_div.text(cpath[j]);
      files_col.append(fp_div);
    }

    var size_span = $("<span>").addClass("file-size");
    var time_span = $("<span>").addClass("file-time");
    size_span.text(humanFileSize(val.files[i].size));
    time_span.text(val.files[i].time);
    fp_div.append(size_span);
    fp_div.append(time_span);

    cd.pop();
  }
  this_row.append(files_col);
}

function changePage (page) {
  var maxpage = $("#movie-table").data("maxpage");

  if (page >= maxpage || page < 0) {
    return;
  }

  var todisplay = all_movies.slice(page*entry_per_page, (page+1)*(entry_per_page));

  $("#movie-table").data("page", page);

  $("#movie-table-body").empty();
  todisplay.forEach(function (mid) {
    addRow(mid);
  });

  $("#current-page").text(page+1);
  $("#max-page").text(maxpage);
}

function setupPages () {
  var page_n = Math.ceil(all_movies.length / entry_per_page);
  $("#movie-table").data("maxpage", page_n != 0 ? page_n : 1);

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
  all_movies = [];
  $.each(movie_data, function (key, val) {
    all_movies.push(key);
  });
  setupPages();
}

function filterMovieByGenre (genre) {
  all_movies = [];
  $.each(movie_data, function (key, val) {
    if (val.genres.indexOf(genre) != -1) {
      all_movies.push(key);
    }
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
  if (sortby == 'title') {
    all_movies.sort(function (a, b) {
      return movie_data[a].title[0].localeCompare(movie_data[b].title[0], 'zh-Hans-CN');
    });
  } else {
    all_movies.sort(function (a, b) {
      return movie_data[a][sortby] - movie_data[b][sortby];
    });
  }

  reverse ? all_movies.reverse() : 0;
  changePage(0);
}

$(document).ready(function() {

  $.getJSON("/list.json", function (data) {
    movie_data = data;

    $.each(data, function (key, val) {
      // autocomplete
      val.title.forEach( function (e) {
        if (autocomp_name.indexOf(e) == -1) {
          autocomp_name.push(e);
        }
      });

      val.genres.forEach(function (e) {
        if (autocomp_genre.indexOf(e) == -1) {
          autocomp_genre.push(e);
        }
      })

      all_movies.push(key);
    });

    setupPages();
  });

  $('#searchkey').autocomplete ({
    source: function (request, response) {
      var key = request.term.toLowerCase();
      function key_in_str (s) {
        return s.toLowerCase().indexOf(key) != -1;
      }

      if ($('#searchtype').val() == "title") {
        response($.grep(autocomp_name, key_in_str));
      }
      else if ($('#searchtype').val() == "genre") {
        response($.grep(autocomp_genre, key_in_str));
      }
    }
  });

  //$('#searchkey').attr('list', "data-" + $('#searchtype').val());

  //$('#searchtype').on('change', function() {
  //  $('#searchkey').attr('list', "data-" + this.value);
  //});

  $('#searchbutton').click(function () {
    var type = $("#searchtype").val();
    var keyword = $("#searchkey").val();

    if (type == 'title') {
      filterMovieByTitle(keyword);
    }
    else if (type == 'genre') {
      filterMovieByGenre(keyword);
    }
    else if (type == 'path'){
      var re = new RegExp(keyword, "i");
      filterMovieByPath(re);
    }
  });

  $('#searchkey').keypress(function(event) {
    if (event.keyCode == 13) {
      event.preventDefault();
      $('#searchbutton').click();
      return false;
    }
    return true;
  });

  $('#resetbutton').click(function () {
    $("#searchkey").val("");
    showAllMovies();
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
  $('#last-page').click(function () {changePage($("#movie-table").data("maxpage")-1)});
  $('#prev-page').click(function () {changePage($("#movie-table").data("page")-1)});
  $('#next-page').click(function () {changePage($("#movie-table").data("page")+1)});
});
