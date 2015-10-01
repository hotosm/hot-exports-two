#!/bin/bash

# find all files, ignore directories .git, *static*, locales, doc
# clear any whitespace/trailingspace
find . -not \( -name .git -prune -o -wholename '*static*' -prune -o -name locales -prune -o -name doc -prune \) -type f -print0 | xargs -0 sed -i 's/[ \t]*$//'

# apply specific autopep8 rules, exclude anything in ./ui/static directory
# https://github.com/hhatto/autopep8#features
autopep8 -v -r -i --exclude './ui/static/*' --select=E251,E231,E303,E261,E272,E201,E222,E302,E225,E111,E221,E202,E203,E703,E271,E301,E701,E241 .