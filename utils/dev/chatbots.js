#!/usr/bin/env node

// Opens KudoAI chatbots in VS Code

const projects = ['amazongpt', 'bravegpt', 'duckduckgpt', 'googlegpt']

// Import LIBS
const { resolve, dirname } = require('path')

// Init PATHS
const repoRoot = (dir => {
    while (dir != '/' && !require('fs').existsSync(resolve(dir, 'package.json'))) dir = dirname(dir) ; return dir
})(__dirname)
const filePaths = projects.map(
    project => resolve(repoRoot, `${project}/greasemonkey/${project}.user.js`)
).filter(path => require('fs').existsSync(path))

// OPEN files
require('child_process').execFileSync('code', [repoRoot, ...filePaths], { stdio: 'inherit' })
