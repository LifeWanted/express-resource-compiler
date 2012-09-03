
var fs      = require( 'fs' );
var path    = require( 'path' );
var async   = require( 'async' );

function existsWrapper( filePath, callback ){
    fs.exists( filepath, function( exists ){ callback( null, exists ); } );
}

function makePath( destinationPath, callback ){
    var pathParts = path.normalize( destinationPath ).split( path.sep );
    var existChecks = [];
    for( var i = 0; i < pathParts.length; ++i ){
        existChecks.push( existsWrapper.bind( null, path.join( pathParts.slice( 0, i ) ) ) );
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
}

function compile( opts, sourceFile, destinationFile, callback ){
    if( opts.stream ){
        var destinationStream   = fs.createWriteStream( destinationFile, { encoding : 'utf8' } );
        var compilerStream      = opts.compile( destinationStream );
        var sourceStream        = fs.createReadStream( sourceFile, { encoding : 'utf8' } );

        sourceStream.pipe( compilerStream );
        compilerStream.on( 'close', callback );
    }
    else {
        async.waterfall([
            fs.readFile.bind( fs, sourceFile, 'utf8' ),
            opts.compiler.bind( opts ),
            fs.writeFile.bind( fs, destinationFile )
        ], callback );
    }
}

module.exports = function( compiler, opts ){
    opts = opts || {};
    opts.compile = compiler;

    var sourcePath      = opts.src  || '';
    var destinationPath = opts.dest || opts.src;

    return function( req, res, next ){
        // Determine the source and destination paths.
        var file            = req.path.substr( req.route.length );
        var sourceFile      = path.join( sourcePath || req.route, file );
        var destinationFile = path.join( destinationPath || req.route, file );

        // Ignore all requests that are not for the specified extention, if one is specified.
        if( opts.ext && path.extname( file ) != opts.ext ){
            next();
            return;
        }

        // Then check if both files exist.
        async.parallel({
            source      : existsWrapper.bind( sourceFile ),
            destination : existsWrapper.bind( destinationFile )
        }, function( err, exists ){
            // If the source doesn't exist, 404.
            if( !exists.source ){
                res.writeHead( 404, 'Not Found' );
                res.end();
            }

            // If the destination doesn't exist, compile immediately.
            else if( !exists.destination ){
                async.serial([
                    makePath.bind( null, path.dirname( destinationFile ) ),
                    compile.bind( null, opts, sourceFile, destinationFile )
                ], next );
            }

            // Both files exist, so check their last modified times.
            else {
                async.parallel({
                    source      : fs.stat.bind( fs, sourceFile ),
                    destination : fs.stat.bind( fs, destinationFile )
                }, function( err, stat ){
                    // If the source file is newer than the destination, recompile.
                    if( stat.source.mtime.getTime() > stat.destination.mtime.getTime() ){
                        compile( opts, sourceFile, destinationFile, next );
                    }

                    // Otherwise just move on.
                    else {
                        next();
                    }
                });
            }
        });
    };
};




