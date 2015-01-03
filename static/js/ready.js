var DBMOVIE_SUB = "http://movie.douban.com/subject/";
var loaded = false;

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

$(document).ready(function() {
  loaded = true;
});

var genres = [];

function addRow (key, val) {
  var this_row = $("<tr>").attr('id', 'm'+key);
  $("#movie-table").append(this_row);

  // movie name
  var name_col = $("<td>");
  this_row.append(name_col);

  var zh_name_a = $("<a>").addClass("zh-title").attr(
                  'href', DBMOVIE_SUB + key).text(val.title[0]);
  name_col.append(zh_name_a);

  if (val.title[0] != val.title[1]) {
    var orig_name_div = $("<div>").addClass("orig-title").text(val.title[1]);
    name_col.append(orig_name_div);
  }

  this_row.append($("<td>").addClass("mv-year").text(val.year));

  // rating
  var rating_col = $("<td>");
  var rating_div = $("<div>").addClass("mv-rating").text(val.rating.toFixed(1));
  rating_col.append(rating_div);
  this_row.append(rating_col);

  // genres
  var genres_col = $("<td>");
  for (var i=0; i<val.genres.length; i++) {
    var genre_span = $("<span>").addClass("label label-primary mv-genre");
    genre_span.text(val.genres[i]);
    genres_col.append(genre_span);
  }
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

  // autocomplete
  val.title.forEach( function (e) {
    $('#data-name').append($("<option>").attr('value',e));
  });

  for (var i=0; i<val.genres.length; i++) {
    var genre = val.genres[i];
    if (genres.indexOf(genre) == -1) {
      $('#data-genre').append("<option>"+genre+"</option>");
      genres.push(genre[i]);
    }
  }
}

$.getJSON("/list.json", function (data) {
  while (!loaded) {
    continue;
  }

  var start_time = (new Date()).getTime();

  $(document).data("list", data);

  var timeout = 0;
  $.each(data, function (key, val) {
    setTimeout(addRow, timeout += 8, key, val);
  });

  $("input").attr("disabled", "disabled");
  $("#movie-table").addClass("tablesorter");
  setTimeout(function () {
      $("input").removeAttr("disabled");
      $("#movie-table").tablesorter();
      var end_time = (new Date()).getTime();
      console.log("Time to parse json:", (end_time - start_time)/1000);
  }, timeout + 500);

  $('#searchkey').attr('list', "data-" + $('#searchtype').val());

  $('#searchtype').on('change', function() {
    $('#searchkey').attr('list', "data-" + this.value);
  });

  $('#searchbutton').click(function () {
    var type = $("#searchtype").val();
    var keyword = $("#searchkey").val();

    if (type == 'name') {
      $.each($(document).data("list"), function (key, val) {

        var names = val.title.concat(val.aka);
        var found = false;

        for (var i=0; i<names.length; i++) {
          if (names[i].search(keyword) != -1) {
            found = true;
            break;
          }
        }

        found ? $("#m" + key).show() : $("#m" + key).hide();
      });
    }
    else if (type == 'genre') {
      $.each($(document).data("list"), function (key, val) {
        if (val.api_success) {
          val.genres.indexOf(keyword) != -1 ? $("#m" + key).show() : $("#m" + key).hide();
        }
      });
    }
    else if (type == 'path'){
      var re = new RegExp(keyword, "i");
      $.each($(document).data("list"), function (key, val) {
        if (val.api_success) {
          $("#m" + key).hide();
          val.files.forEach(function (f) {
              var path = f.path.join('/');
              path.search(re) != -1 ? $("#m" + key).show() : 0;
          });
        }
      });
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
    $('#searchbutton').click();
  });
});
