const fs = require('fs');
const acorn = require('acorn');
const jsx = require('acorn-jsx');
const parser = acorn.Parser.extend(jsx());
try {
  parser.parse(fs.readFileSync('src/App.js', 'utf8'), { sourceType: 'module', ecmaVersion: 2020 });
  console.log("OK");
} catch(e) {
  console.log(e.message, e.loc);
}
