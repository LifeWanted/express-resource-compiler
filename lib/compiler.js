
var fs      = require( 'fs' );
var path    = require( 'path' );
var async   = require( 'async' );
var util    = require( './util' );

function compile( opts, sourceFile, destinationFile, callback ){
    if( opts.stream ){
        var destinationStream   = fs.createWriteStream( destinationFile, { encoding : 'utf8' } );
        var compilerStream      = opts.compile( destinationStream, sourceFile );
        var sourceStream        = fs.createReadStream( sourceFile, { encoding : 'utf8' } );

        sourceStream.pipe( compilerStream );
        compilerStream.on( 'end', callback );
    }
    else {
        async.waterfall([
            fs.readFile.bind( fs, sourceFile, 'utf8' ),
            opts.compiler.bind( opts, sourceFile ),
            fs.writeFile.bind( fs, destinationFile )
        ], callback );
    }
}

module.exports = function( compiler, opts ){
    opts = util.defaultOptions( compiler, opts );
    var sourcePath      = opts.src;
    var destinationPath = opts.dest;

    return function( req, res, next ){
        // Determine the source and destination paths.
        var file            = req.path;
        var sourceFile      = path.join( sourcePath         || req.route.path, file );
        var destinationFile = path.join( destinationPath    || req.route.path, file );

        // Ignore all requests that are not for the specified extention, if one is specified.
        if( opts.ext && path.extname( file ) != opts.ext ){
            next();
            return;
        }

        // Then check if both files exist.
        async.parallel({
            source      : util.fileExists.bind( null, sourceFile ),
            destination : util.fileExists.bind( null, destinationFile )
        }, function( err, exists ){
            // If the source doesn't exist, 404.
            if( !exists.source ){
                res.writeHead( 404, 'Not Found' );
                res.end();
            }

            // If the destination doesn't exist, compile immediately.
            else if( !exists.destination ){
                async.series([
                    util.makePath.bind( null, path.dirname( destinationFile ) ),
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
