#!/bin/bash
redis-cli KEYS "p_*" \
    | grep -P "[^[:ascii:]]" \
    | xargs -L1 -I '$' echo '"$"' \
    | xargs redis-cli del
