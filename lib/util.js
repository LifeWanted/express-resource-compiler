
exports.defaultOptions = function( compiler, opts ){
    opts            = opts      || {};
    opts.compiler   = compiler;
    opts.src        = opts.src  || '';
    opts.dest       = opts.dest || opts.src;
};

exports.fileExists = function( filePath, callback ){
    fs.exists( filepath, function( exists ){ callback( null, exists ); } );
};


exports.makePath = function( destinationPath, callback ){
    var pathParts = path.normalize( destinationPath ).split( path.sep );
    var existChecks = [];
    for( var i = 0; i < pathParts.length; ++i ){
        existChecks.push( util.fileExists.bind( null, path.join( pathParts.slice( 0, i ) ) ) );
    }

    async.parallel( existChecks, function( err, exists ){
        var toMake = [];
        for( var i = 0; i < exists.length; ++i ){
            if( !exists[ i ] ){
                toMake.push( fs.mkdir.bind( fs, path.join( pathParts.slice( 0, i ) ) ) );
            }
        }

        if( toMake.length ){
            async.serial( toMake, callback );
        }
        else {
            callback();
        }
    });
};
