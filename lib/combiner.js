
var fs              = require( 'fs' );
var async           = require( 'async' );
var path            = require( 'path' );
var util            = require( './util' );
var CombineStream   = require( './CombineStream' );
var url             = require( 'url' );

function combine( opts, sourceFiles, destinationFile, callback ){
    if( opts.stream ){
        var destinationStream   = fs.createWriteStream( destinationFile, { encoding : 'utf8' } );
        var compilerStream      = opts.compile( destinationStream, destinationFile );
        var sourceStream        = CombineStream.combineFiles( sourceFiles, { encoding : 'utf8' } );

        sourceStream.pipe( compilerStream );
        compilerStream.on( 'end', callback );
    }
    else {
        var readBinds = [];
        for( var i = 0; i < sourceFiles.length; ++i ){
            readBinds.push( fs.readFile.bind( fs, sourceFiles[ i ], 'utf8' ) );
        }

        async.waterfall([
            async.parallel.bind( async, readBinds ),
            combineFiles,
            opts.compiler.bind( opts, destinationFile ),
            fs.writeFile.bind( fs, destinationFile )
        ], callback );
    }
}

function combineFiles( files, callback ){
    var allData = files.reduce( function( allData, file ){ return allData + file; }, '' );
    callback( null, allData );
}

function cleanFileList( goodFiles, files ){
    for( var i = 0; i < files.length; ++i ){
        var file = files[ i ];
        if( file instanceof Array ){
            cleanFileList( goodFiles, file );
        }
        else if( file ){
            goodFiles.push( file );
        }
    }
}

function listFiles( opts, sourceDirectory, fileList, callback ){
    fileList.sort();
    async.map( fileList, function( fileName, callback ){
        var file = path.join( sourceDirectory, fileName );
        fs.stat( file, function( err, stats ){
            if( err ){
                callback( err );
                return;
            }

            if( stats.isDirectory() ){
                async.waterfall([
                    fs.readdir.bind( fs, file ),
                    listFiles.bind( null, opts, file )
                ], callback );
            }
            else if( stats.isFile() && (!opts.ext || path.extname( file ) == opts.ext) ){
                callback( null, file );
            }
            else {
                callback();
            }
        });
    }, function( err, files ){
        if( err ){
            callback( err );
            return;
        }

        var goodFiles = [];
        cleanFileList( goodFiles, files );
        callback( null, goodFiles );
    });
}

module.exports = function( compiler, opts ){
    opts = util.defaultOptions( compiler, opts );
    var sourcePath      = opts.src;
    var destinationPath = opts.dest;

    return function( req, res, next ){
        // Determine the source and destination paths.
        var file            = url.parse( req.originalUrl ).pathname;
        var noExt           = path.basename( file, path.extname( file ) );
        var sourceDirectory = path.join( sourcePath || req.route, noExt );
        var destinationFile = path.join( destinationPath || req.route, path.basename( file ) );

        async.parallel({
            'files'     : fs.readdir.bind( fs, sourceDirectory ),
            'exists'    : util.fileExists.bind( null, destinationFile )
        }, function( err, checks ){
            if( err ){
                next( err );
                return;
            }

            listFiles( opts, sourceDirectory, checks.files, function( err, files ){
                if( err ){
                    next( err );
                    return;
                }

                // If the destination file doesn't exist, go straight to combining.
                if( !checks.exists ){
                    async.series([
                        util.makePath.bind( null, path.dirname( destinationFile ) ),
                        combine.bind( null, opts, files, destinationFile )
                    ], next );
                    return;
                }

                // The destination file does exist, so lets check modified times.
                async.parallel({
                    'sources'       : async.map.bind( async, files, fs.stat ),
                    'destination'   : fs.stat.bind( fs, destinationFile )
                }, function( err, stats ){
                    if( err ){
                        next( err );
                        return;
                    }

                    // Check the last modified times of each source file. If any are newer, recombine.
                    var destModTime = stats.destination.mtime.getTime();
                    var sourceStats = stats.sources;
                    for( var i = 0; i < sourceStats.length; ++i ){
                        if( sourceStats[ i ].mtime.getTime() > destModTime ){
                            combine( opts, files, destinationFile, next );
                            return;
                        }
                    }

                    // None of the files are newer, so move on.
                    next();
                });
            });

            });
    };
};
