
var fs      = require( 'fs' );
var path    = require( 'path' );
var async   = require( 'async' );

exports.defaultOptions = function( compiler, opts ){
    if( compiler && typeof compiler != 'function' && !opts ){
        opts = compiler;
    }

    opts            = opts          || {};
    opts.compile    = opts.compile  || compiler || passThrough;
    opts.src        = opts.src      || '';
    opts.dest       = opts.dest     || opts.src;
    opts.encoding   = opts.encoding || 'utf8';

    return opts;
};

exports.fileExists = function( filePath, callback ){
    fs.exists( filePath, function( exists ){ callback( null, exists ); } );
};

exports.makePath = function( destinationPath, callback ){
    var pathParts = path.normalize( destinationPath ).split( path.sep );
    var existChecks = [];
    pathParts[ 0 ] = path.sep;
    for( var i = 1; i < pathParts.length + 1; ++i ){
        existChecks.push(
            exports.fileExists.bind( null, path.join.apply( path, pathParts.slice( 0, i ) ) )
        );
    }

    async.parallel( existChecks, function( err, exists ){
        var toMake = [];
        for( var i = 0; i < exists.length; ++i ){
            if( !exists[ i ] ){
                toMake.push(
                    fs.mkdir.bind( fs, path.join.apply( path, pathParts.slice( 0, i + 1 ) ) )
                );
            }
        }

        if( toMake.length ){
            async.series( toMake, callback );
        }
        else {
            callback();
        }
    });
};

function passThrough( path, data, callback ){
    callback( null, data );
}
