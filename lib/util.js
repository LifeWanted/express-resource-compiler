
exports.defaultOptions = function( compiler, opts ){
    opts            = opts      || {};
    opts.compiler   = compiler;
    opts.src        = opts.src  || '';
    opts.dest       = opts.dest || opts.src;
}

exports.fileExists = function( filePath, callback ){
    fs.exists( filepath, function( exists ){ callback( null, exists ); } );
}

