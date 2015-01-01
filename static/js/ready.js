var DBMOVIE_SUB = "http://movie.douban.com/subject/";

$(document).ready(function() {

  $.getJSON("/list.json", function (data) {
    $(document).data("list", data);

    $.each(data, function (key, val) {
      if (val.api_success){
        var this_row = $("<tr></tr>").attr('id', 'm'+key);

        // movie name
        var name_col = $("<td></td>");

        var zh_name_a = $("<a></a>").attr('href', DBMOVIE_SUB + key).text(val.title[0]);
        var zh_name_div = $("<div></div>").addClass("zh-title");
        zh_name_div.append(zh_name_a);
        name_col.append(zh_name_div);

        if (val.title[0] != val.title[1]) {
          var orig_name_div = $("<div></div>").addClass("orig-title").text(val.title[1]);
          name_col.append(orig_name_div);
        }

        this_row.append(name_col);

        // release year
        var year_col = $("<td></td>");
        var year_div = $("<div></div>").addClass("mv-year").text(val.year);
        year_col.append(year_div);
        this_row.append(year_col);

        // rating
        var rating_col = $("<td></td>");
        var rating_div = $("<div></div>").addClass("mv-rating").text(val.rating.toFixed(1));
        rating_col.append(rating_div);
        this_row.append(rating_col);

        // genres
        var genres_col = $("<td></td>");
        //var genre_div = $("<div></div>").addClass("mv-genre").text(val.genres[i]);
        for (var i=0; i<val.genres.length; i++) {
          var genre_span = $("<span></span>").addClass("label label-primary mv-genre");
          genre_span.text(val.genres[i]);
          genres_col.append(genre_span);
        }
        this_row.append(genres_col);

        // file info
        var files_col = $("<td></td>");
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
            var fp_div = $("<div></div>").addClass("plevel").css("margin-left", j + "em");
            fp_div.text(cpath[j]);
            files_col.append(fp_div);
          }

          cd.pop();
        }
        this_row.append(files_col);

        // done this row
        $("#movie-table").append(this_row);

        // autocomplete
        val.title.forEach( function (e) {
          var opt = $("<option></option>").attr('value', e);
          $('#data-name').append(opt);
        });
        val.aka.forEach( function (e) {
          var opt = $("<option></option>").attr('value', e);
          $('#data-name').append(opt);
        });
      }
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
        // todo
      }
      else if (type == 'path'){
        // todo
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
});
