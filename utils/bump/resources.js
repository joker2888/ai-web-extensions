#!/usr/bin/env node

// Bumps @require'd JS + rising-stars CSS @resource's in userscripts
// NOTE: Doesn't git commit to allow script editing from breaking changes
// NOTE: Pass --dev to use dev/userJSfiles.json for faster init

(async () => {

    const devMode = process.argv.includes('--dev')

    // Import LIBS
    const fs = require('fs'), // to read/write files
          path = require('path'), // to manipulate paths
          ssri = require('ssri') // to generate SHA-256 hashes

    // Init UI COLORS
    const nc = '\x1b[0m',        // no color
          dg = '\x1b[38;5;243m', // dim gray
          bw = '\x1b[1;97m',     // bright white
          by = '\x1b[1;33m',     // bright yellow
          bg = '\x1b[1;92m',     // bright green
          br = '\x1b[1;91m'      // bright red

    // Init REGEX
    const rePatterns = {
        resourceName: /[^/]+\/(?:css|dist)?\/?[^/]+\.(?:css|js)(?=[?#]|$)/,
        cssURL: /^\/\/ @resource.+(https:\/\/assets.+\.css.+)$/,
        jsURL: /^\/\/ @require\s+(https:\/\/cdn\.jsdelivr\.net\/gh\/.+)$/,
        commitHash: /(@|\?v=)([^/#]+)/, sriHash: /[^#]+$/
    }

    // Define FUNCTIONS

    const log = { dev(msg) { if (devMode) console.log(msg) }};
    ['hash', 'info', 'working', 'success', 'error'].forEach(lvl => log[lvl] = function(msg) {
        const logColor = lvl == 'hash' ? dg : lvl == 'info' ? bw : lvl == 'working' ? by : lvl == 'success' ? bg : br,
              formattedMsg = logColor + ( log.endedWithLineBreak ? msg.trimStart() : msg ) + nc
        console.log(formattedMsg) ; log.endedWithLineBreak = msg.toString().endsWith('\n')
    })

    async function findUserJS(dir = findUserJS.monorepoRoot) {
        const userJSfiles = []
        if (!dir && !findUserJS.monorepoRoot) { // no arg passed, init monorepo root
            dir = __dirname
            while (!fs.existsSync(path.join(dir, 'package.json')))
                dir = path.dirname(dir) // traverse up to closest manifest dir
            findUserJS.monorepoRoot = dir
        }
        dir = path.resolve(dir)
        fs.readdirSync(dir).forEach(async entry => {
            if (/^(?:\.|node_modules$)/.test(entry)) return
            const entryPath = path.join(dir, entry)
            if (fs.statSync(entryPath).isDirectory()) // recursively search subdirs
                userJSfiles.push(...await findUserJS(entryPath))
            else if (entry.endsWith('.user.js')) {
                console.log(entryPath) ; log.endedWithLineBreak = false
                userJSfiles.push(entryPath)
            }
        })
        return userJSfiles
    }

    function fetchData(url) {
        if (typeof fetch == 'undefined') // polyfill for Node.js < v21
            return new Promise((resolve, reject) => {
                try { // to use http or https module
                    const protocol = url.match(/^([^:]+):\/\//)[1]
                    if (!/^https?$/.test(protocol)) reject(new Error('Invalid fetchData() URL.'))
                    require(protocol).get(url, resp => {
                        let rawData = ''
                        resp.on('data', chunk => rawData += chunk)
                        resp.on('end', () => resolve({ json: () => JSON.parse(rawData) }))
                    }).on('error', err => reject(new Error(err.message)))
                } catch (err) { reject(new Error('Environment not supported.'))
            }})
        else // use fetch() from Node.js v21+
            return fetch(url)
    }

    async function isValidResource(resourceURL) {
        try {
            const resourceIsValid = !(await (await fetchData(resourceURL)).text()).startsWith('Package size exceeded')
            if (!resourceIsValid) log.error(`\nInvalid resource: ${resourceURL}\n`)
            return resourceIsValid
        } catch (err) {
            log.error(`\nCannot validate resource: ${resourceURL}\n`)
            return null
        }
    }

    async function getSRIhash(url, algorithm = 'sha256') {
        const sriHash = ssri.fromData(
            Buffer.from(await (await fetchData(url)).arrayBuffer()), { algorithms: [algorithm] }).toString()
        log.hash(`${sriHash}\n`)
        return sriHash
    }

    function bumpUserJSver(userJSfilePath) {
        const date = new Date(),
              today = `${date.getFullYear()}.${date.getMonth() +1}.${date.getDate()}`, // YYYY.M.D format
              reVersion = /(@version\s+)([\d.]+)/,
              userJScontent = fs.readFileSync(userJSfilePath, 'utf-8'),
              currentVer = userJScontent.match(reVersion)[2]
        let newVer
        if (currentVer.startsWith(today)) { // bump sub-ver
            const verParts = currentVer.split('.'),
                  subVer = verParts.length > 3 ? parseInt(verParts[3], 10) +1 : 1
            newVer = `${today}.${subVer}`
        } else // bump to today
            newVer = today
        fs.writeFileSync(userJSfilePath, userJScontent.replace(reVersion, `$1${newVer}`), 'utf-8')
        console.log(`Updated: ${bw}v${currentVer}${nc} → ${bg}v${newVer}${nc}`)
    }

    // Run MAIN routine

    // Collect userscripts
    log.working(`\n${ devMode ? 'Collecting' : 'Searching for' } userscripts...\n`)
    const userJSfiles = await (async () =>
        devMode ? JSON.parse(
            await fs.promises.readFile(path.join(__dirname, 'dev/userJSfiles.json'), 'utf-8'))
                : findUserJS()
    )()
    log.dev(userJSfiles)

    // Collect resources
    log.working('\nCollecting resources...\n')
    const urlMap = {} ; let resourceCnt = 0
    const reResourceURL = new RegExp( // eslint-disable-next-line
        `(?:${rePatterns.cssURL.source})|(?:${rePatterns.jsURL.source})`, 'gm')
    userJSfiles.forEach(userJSfilePath => {
        const userJScontent = fs.readFileSync(userJSfilePath, 'utf-8'),
              resourceURLs = [...userJScontent.matchAll(reResourceURL)].map(match => match[1] || match[2])
        if (resourceURLs.length > 0) { urlMap[userJSfilePath] = resourceURLs ; resourceCnt += resourceURLs.length }
    })
    log.success(`${resourceCnt} potentially bumpable resource(s) found.`)

    // Fetch latest commit hash for adamlui/ai-web-extensions/assets/styles/rising-stars
    const ghEndpoint = 'https://api.github.com/repos/adamlui/ai-web-extensions/commits',
          risingStarsPath = 'assets/styles/rising-stars'
    log.working(`\nFetching latest commit hash for ${risingStarsPath}...\n`)
    const latestCommitHashes = {
        risingStars: (await (await fetch(`${ghEndpoint}?path=${risingStarsPath}`)).json())[0]?.sha }
    log.hash(latestCommitHashes.risingStars)

    // Process each userscript
    let urlsUpdatedCnt = 0 ; let filesUpdatedCnt = 0
    for (const userJSfilePath of Object.keys(urlMap)) {

        // Init repo props
        let repoName = userJSfilePath.split(devMode ? '\\' : '/').pop().replace('.user.js', '')
        if (repoName.endsWith('-mode')) repoName = repoName.slice(0, -5) // for chatgpt-widescreen

        log.working(`\nProcessing ${repoName}...\n`)

        // Fetch latest commit hash
        if (urlMap[userJSfilePath].some(url => url.includes(repoName))) {
            console.log('Fetching latest commit hash for repo...')
            latestCommitHashes.repoResources = require('child_process').execFileSync(
                'git', ['ls-remote', `https://github.com/adamlui/${repoName}.git`, 'HEAD']).toString().split('\t')[0]
            console.log(`${dg + latestCommitHashes.repoResources + nc}\n`)
        }

        // Process each resource
        let fileUpdated = false
        for (const resourceURL of urlMap[userJSfilePath]) {
            if (!await isValidResource(resourceURL)) continue
            const resourceName = rePatterns.resourceName.exec(resourceURL)?.[0] || 'resource' // dir/filename for logs

            // Compare commit hashes
            const resourceLatestCommitHash = latestCommitHashes[
                  resourceURL.includes(repoName) ? 'repoResources' : 'risingStars']
            if (resourceLatestCommitHash.startsWith(
                rePatterns.commitHash.exec(resourceURL)?.[2] || '')) { // commit hash didn't change...
                    console.log(`${resourceName} already up-to-date!`) ; log.endedWithLineBreak = false
                    continue // ...so skip resource
                }
            let updatedURL = resourceURL.replace(rePatterns.commitHash, `$1${resourceLatestCommitHash}`) // otherwise update commit hash
            if (!await isValidResource(updatedURL)) continue

            // Generate/compare SRI hash
            console.log(`${ !log.endedWithLineBreak ? '\n' : '' }Generating SHA-256 hash for ${resourceName}...`)
            const newSRIhash = await getSRIhash(updatedURL)
            if (rePatterns.sriHash.exec(resourceURL)?.[0] == newSRIhash) { // SRI hash didn't change
                console.log(`${resourceName} already up-to-date!`) ; log.endedWithLineBreak = false
                continue // ...so skip resource
            }
            updatedURL = updatedURL.replace(rePatterns.sriHash, newSRIhash) // otherwise update SRI hash
            if (!await isValidResource(updatedURL)) continue

            // Write updated URL to userscript
            console.log(`Writing updated URL for ${resourceName}...`)
            const userJScontent = fs.readFileSync(userJSfilePath, 'utf-8')
            fs.writeFileSync(userJSfilePath, userJScontent.replace(resourceURL, updatedURL), 'utf-8')
            log.success(`${resourceName} bumped!\n`)
            urlsUpdatedCnt++ ; fileUpdated = true
        }
        if (fileUpdated) {
            console.log(`${ !log.endedWithLineBreak ? '\n' : '' }Bumping userscript version...`)
            bumpUserJSver(userJSfilePath) ; filesUpdatedCnt++
        }
    }

    // Log final summary
    log[urlsUpdatedCnt > 0 ? 'success' : 'info'](
        `\n${ urlsUpdatedCnt > 0 ? 'Success! ' : '' }${
              urlsUpdatedCnt} resource(s) bumped across ${filesUpdatedCnt} file(s).`
    )

})()
