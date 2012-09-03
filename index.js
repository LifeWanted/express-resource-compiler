
var compiler = require( './lib/compiler.js' );
var combiner = require( './lib/combiner.js' );

compiler.compiler = compiler;
compiler.combiner = combiner;
module.exports = compiler;
