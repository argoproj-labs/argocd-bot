# Argocd Bot Development

## Development
This is entirely built using Typescript and a few helper scripts in bash.

### Building
To install modules and build ts: `npm install && npm run build`

### Tests
The `test` folder contains all test cases, to run tests: `npm test`

### Logging
This uses probot logging, for further documentation [see](https://probot.github.io/docs/logging/)

## Notes
### Updating packages
This automatically updates dependencies adjusting `package.json`
```
npm install  npm-check-updates
./node_modules/.bin/ncu -u
npm install
```

## Manual Deployment
To run `argocd-bot` in this git repo, install required modules and build typescript:
- `npm install && npm run build`

### Starting Server
`npm start`
