#!/usr/bin/env node

// Opens ChatGPT extension content scripts in VS Code

// NOTE: Pass --chrom<e|ium> to open Chromium files only
// NOTE: Pass --<ff|fire> to open Firefox files only
// NOTE: Pass --<project-name> to only include files from that project (partial match allowed)

// Import LIBS
const { execSync } = require('child_process'),
      { resolve, dirname } = require('path')

const args = process.argv.slice(2)

// Filter PROJECTS
const availProjects = require('./projects.json')
let projectsToOpen = availProjects.filter(project => args.some(arg => project.includes(arg.replace(/^-+/, ''))))
if (!projectsToOpen.length) projectsToOpen = availProjects

// Init PATHS
const repoRoot = (dir => {
    while (dir != '/' && !require('fs').existsSync(resolve(dir, 'package.json'))) dir = dirname(dir) ; return dir
})(__dirname)
const browserFilter = /--chrom/i.test(args) ? 'chromium' : /--(?:ff|firefox)/i.test(args) ? 'firefox' : null
const filePaths = projectsToOpen.flatMap(project =>
    ['chromium', 'firefox']
        .filter(browser => !browserFilter || browser == browserFilter)
        .map(browser => resolve(repoRoot, `${project}/${browser}/extension/content.js`))
).filter(path => require('fs').existsSync(path))

// OPEN files
execSync(`code ${repoRoot} ${filePaths.join(' ')}`, { stdio: 'inherit' })
