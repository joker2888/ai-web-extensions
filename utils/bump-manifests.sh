#!/bin/bash

shopt -s nocasematch  # enable case-insensitive matching

# Init UI colors
NC="\033[0m"    # no color
BR="\033[1;91m" # bright red
BY="\033[1;33m" # bright yellow
BG="\033[1;92m" # bright green
BW="\033[1;97m" # bright white

# Init manifest paths
echo -e "${BY}\nSearching for extension manifests...${NC}\n"
manifest_paths=$(find . -type f -name 'manifest.json')
for manifest_path in $manifest_paths ; do echo "$manifest_path" ; done

# Extract extension project names
echo -e "${BY}\nExtracting extension project names...${NC}\n"
declare -A project_names
for manifest_path in $manifest_paths ; do # extract project names
    project_names[$(echo "$manifest_path" | awk -F '/' '{print $2}')]=true ; done
SORTED_PROJECTS=$(echo "${!project_names[@]}" | tr ' ' '\n' | sort)
for project_name in $SORTED_PROJECTS ; do echo "$project_name" ; done
echo # line break

# Iterate thru projects
bumped_cnt=0
TODAY=$(date +'%Y.%-m.%-d')  # YYYY.M.D format
new_versions=() # for dynamic commit msg
for project_name in $SORTED_PROJECTS ; do
    echo -e "${BY}Processing $project_name...${NC}\n"

    # Iterate thru extension paths
    for manifest_path in $(echo "$manifest_paths" | grep "/$project_name/") ; do
        platform_manifest_path=$(echo "$(dirname "$manifest_path")" | sed 's|^\./||')

        # Check latest commit for extension
        echo "Checking last commit details for $platform_manifest_path..."
        latest_platform_commit_msg=$(git log -1 --format=%s -- "$platform_manifest_path")
        if [[ $latest_platform_commit_msg == bump*(version|manifest)* ]] ; then
            echo -e "No changes found. Skipping...\n"
            continue
        fi

        echo "Bumping version in manifest..."

        # Determine old/new versions
        old_ver=$(sed -n 's/.*"version": *"\([0-9.]*\)".*/\1/p' "$manifest_path")
        if [[ $old_ver == "$TODAY" ]] ; then
            new_ver="$TODAY.1"
        elif [[ $old_ver == "$TODAY."* ]] ; then
            LAST_NUMBER=$(echo "$old_ver" | awk -F '.' '{print $NF}')
            new_ver="$TODAY.$((LAST_NUMBER + 1))"
        else
            new_ver="$TODAY"
        fi
        new_versions+=("$new_ver")

        # Bump old version
        sed -i "s/\"version\": \"$old_ver\"/\"version\": \"$new_ver\"/" "$manifest_path"
        echo -e "Updated: ${BW}v${old_ver}${NC} → ${BG}v${new_ver}${NC}\n"
        ((bumped_cnt++))

    done
done

# Commit/push bump(s)
if [[ $bumped_cnt -eq 0 ]] ; then echo -e "${BW}Completed. No manifests bumped.${NC}"
else
    echo -e "${BY}Committing $( (( bumped_cnt > 1 )) && echo bumps || echo bump) to Git...\n${NC}"

    # Define commit msg
    COMMIT_MSG="Bumped \`version\`"
    unique_versions=($(printf "%s\n" "${new_versions[@]}" | sort -u))
    if [[ ${#unique_versions[@]} -eq 1 ]] ; then COMMIT_MSG+=" to \`${unique_versions[0]}\`" ; fi

    # Commit/push bump(s)
    git add ./**/manifest.json && git commit -n -m "$COMMIT_MSG"
    git push

    # Print final summary
    manifest_label=$( [[ $bumped_cnt -gt 1 ]] && echo "manifests" || echo "manifest")
    echo -e "\n${BG}Success! ${bumped_cnt} ${manifest_label} updated/committed/pushed to GitHub${NC}"
fi
