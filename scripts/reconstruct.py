#!/usr/bin/env python3

import json
import sys


def fill_in(arr, file_info):
    def it(arr, p):
        if len(p) == 1:
            arr.append({
                "type": "file",
                "name": p[0],
                "size": size,
                "time": "1990.10.10",
            })
        else:
            select = None
            for item in arr:
                if item["name"] == p[0]:
                    select = item["contents"]
                    break

            if select is None:
                select = []
                arr.append({
                    "type": "directory",
                    "name": p[0],
                    "contents": select,
                })

            it(select, p[1:])

    size = file_info["size"]
    paths = file_info["path"]
    it(arr, paths)


data = json.load(sys.stdin)
result = []

for mid, obj in data.items():
    for f in obj["files"]:
        fill_in(result, f)

json.dump(result, sys.stdout)
