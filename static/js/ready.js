var DBMOVIE_SUB = "http://movie.douban.com/subject/";
var loaded = false;

// from: https://stackoverflow.com/questions/10420352/converting-file-size-in-bytes-to-human-readable
function humanFileSize (bytes, si) {
    var thresh = si ? 1000 : 1024;
    if(bytes < thresh) return bytes + ' B';
    var units = si ? ['kB','MB','GB','TB','PB','EB','ZB','YB'] : ['KiB','MiB','GiB','TiB','PiB','EiB','ZiB','YiB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while(bytes >= thresh);
    return bytes.toFixed(2)+' '+units[u];
};

$(document).ready(function() {
  loaded = true;
});

$.getJSON("/list.json", function (data) {
  while (!loaded) {
    continue;
  }

  $(document).data("list", data);

  var genres = [];

  $.each(data, function (key, val) {
    var this_row = $("<tr>").attr('id', 'm'+key);

    // movie name
    var name_col = $("<td>");

    var zh_name_a = $("<a>").attr('href', DBMOVIE_SUB + key).text(val.title[0]);
    var zh_name_div = $("<div>").addClass("zh-title");
    zh_name_div.append(zh_name_a);
    name_col.append(zh_name_div);

    if (val.title[0] != val.title[1]) {
      var orig_name_div = $("<div>").addClass("orig-title").text(val.title[1]);
      name_col.append(orig_name_div);
    }

    this_row.append(name_col);

    // release year
    var year_col = $("<td>");
    var year_div = $("<div>").addClass("mv-year").text(val.year);
    year_col.append(year_div);
    this_row.append(year_col);

    // rating
    var rating_col = $("<td>");
    var rating_div = $("<div>").addClass("mv-rating").text(val.rating.toFixed(1));
    rating_col.append(rating_div);
    this_row.append(rating_col);

    // genres
    var genres_col = $("<td>");
    //var genre_div = $("<div></div>").addClass("mv-genre").text(val.genres[i]);
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

    // done this row
    $("#movie-table").append(this_row);

    // autocomplete
    val.title.forEach( function (e) {
      var opt = $("<option>").attr('value', e);
      $('#data-name').append(opt);
    });
    val.aka.forEach( function (e) {
      var opt = $("<option>").attr('value', e);
      $('#data-name').append(opt);
    });

    val.genres.forEach( function (e) {
      if (genres.indexOf(e) == -1){
        genres.push(e);
        $('#data-genre').append("<option>"+e+"</option>");
      }
    });
  });

  $("#movie-table").addClass("tablesorter");
  $("#movie-table").tablesorter({sortList: [[0, 0]]});

  $('#searchkey').attr('list', "data-" + $('#searchtype').val());

  $('#searchtype').on('change', function() {
    $('#searchkey').attr('list', "data-" + this.value);
  });

  $('#searchbutton').click(function () {
    var type = $("#searchtype").val();
    var keyword = $("#searchkey").val();

    if (type == 'name') {
      $.each($(document).data("list"), function (key, val) {
        if (val.api_success == false) {
          return;
        }

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
