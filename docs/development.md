# Argocd Bot Development

## Development
This is entirely built using Javascript and a few helper scripts in bash.


## Tests
The `test` folder contains all test cases, to run tests: `npm test`

## Logging
This uses probot logging, for further documentation [see](https://probot.github.io/docs/logging/)

## Notes
### Updating packages
This automatically updates dependencies adjusting `package.json`
```
npm install  npm-check-updates
./node_modules/.bin/ncu -u
npm install
```
