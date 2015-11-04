#!/bin/bash
redis-cli KEYS "p_*" | while read line; do
    redis-cli GET "$line" | grep -qP '^[0-9]{3}'
    if [[ "$?" == 1 ]]; then
        echo "Delete key \"$line\"..."
        redis-cli DEL "$line" &
    fi
done

redis-cli KEYS "tt*" | while read line; do
    redis-cli GET "$line" | grep -qPv '"Error":'
    if [[ "$?" == 1 ]]; then
        echo "Delete key \"$line\"..."
        redis-cli DEL "$line" &
    fi
done
