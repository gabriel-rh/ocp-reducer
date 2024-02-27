#!/bin/bash

# Check if the correct number of arguments are provided
if [ "$#" -ne 1 ]; then
    echo "Usage: $0 <directory>"
    exit 1
fi

# Assign the directory parameter to a variable
directory="$1"

# Perform the diff command
diff "openshift-enterprise/4.14/reduced-build/$directory/master-reduced.xml" "openshift-enterprise/4.14/drupal-build/openshift-enterprise/$directory/build/master.xml"
