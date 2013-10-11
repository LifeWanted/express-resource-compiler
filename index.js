
var async   = require( 'async' );
var fs      = require( 'fs' );
var path    = require( 'path' );

var util    = require( './lib/util.js' );

///
/// Opts : {
///     source      : Path to source directory.
///     destination : Path to directory to save final data to.
///     next        : Read/Write Stream to pass the files to next.
///     encoding    : Incoming file encoding, defaults to `utf-8`.
///     extension   : An extension to filter by when listing all the file names.
/// }
///
module.exports = function( opts ){

    return function( req, res, next ){
        // Determine the source and destination paths.
        var file            = req.path;
        var extension       = path.extname( file );
        var noExt           = file.substr( 0, file.length - extension.length );
        var sourcePath      = path.join( opts.source        || req.route.path, noExt );
        var destinationPath = path.join( opts.destination   || req.route.path, path.basename( file ) );

        async.waterfall([
            // First determine if anything even needs to be done.
            function( cb ){
                // Find info about the source file and the destination.
                async.parallel({
                    'dirExists'     : function( cb ){ util.fileExists( sourcePath, cb ); },
                    'fileExists'    : function( cb ){ util.fileExists( sourcePath + extension, cb ); },
                    'destExists'    : function( cb ){ util.fileExists( destinationPath, cb ); }
                }, function( err, checks ){
                    if( err ){
                        return next( err );
                    }

                    // If the file exists, then we are dealing with a simple single-file copy.
                    if( checks.fileExists ){
                        // If the source is a single file and exists, and the destination also
                        // exists then compare the last modified times.
                        if( checks.destExists ){
                            _compareTimes(
                                sourcePath + extension,
                                destinationPath,
                                function( err, needCompile ){
                                    cb( err, needCompile && (sourcePath + extension) );
                                });
                        }

                        // The source file exists and the destination doesn't, skip ahead to
                        // compiling the file after making sure the path exists.
                        else {
                            util.makePath( opts.destination || req.route.path, function( err ){
                                cb( err, sourcePath + extension );
                            });
                        }
                    }

                    // Otherwise, if the source is a directory we will need to merge them together.
                    else if( checks.dirExists ){
                        // The source exists as does the destination, so we need to check all the
                        // files in the source directory and then compare the times.
                        if( checks.destExists ){
                            async.waterfall([
                                function( cb ){ _compileSourceList( sourcePath, cb ); },
                                function( sourceList, cb ){
                                    _compareTimes( sourceList, destinationPath, cb );
                                }
                            ], function( err, needCompile ){
                                cb( err, needCompile && (sourcePath + extension) );
                            });
                        }

                        // Otherwise the destination doesn't exist so we can move on to the next
                        // step after making the path.
                        else {
                            util.makePath( opts.destination || req.route.path, function( err ){
                                if( err ){
                                    cb( err );
                                }
                                else {
                                    _compileSourceList( sourcePath, cb );
                                }
                            });
                        }
                    }

                    // Otherwise the source does not exist at all, so we should just skip ahead.
                    else {
                        cb( true );
                    }
                });
            },

            // Next step is to load up the source files and begin sending them down the pipe.
            function( sourceFiles, cb ){
                // Make sure we have the source files how we need them.
                if( !sourceFiles || !sourceFiles.length ){
                    return cb( true );
                }
                if( !Array.isArray( sourceFiles ) ){
                    sourceFiles = [ sourceFiles ];
                }
                sourceFiles.sort();

                // Open a stream to the destination.
                var outStream = fs.createWriteStream( destinationPath, {
                    flags       : 'w',
                    encoding    : opts.encoding || 'utf-8'
                });
                outStream.on( 'finish', cb );

                // Decide on the next stream.
                var nextStream = opts.next;
                if( nextStream ){
                    nextStream.pipe( outStream );
                }
                else {
                    nextStream = outStream;
                }

                // Step through each file and open it for reading, piping through to the next stream
                // in the series.
                async.eachSeries(
                    sourceFiles,
                    function( filePath, cb ){
                        var fileStream = fs.createReadStream( filePath, {
                            flags       : 'r',
                            encoding    : opts.encoding || 'utf-8'
                        });
                        if( nextStream.setFilePath ){
                            nextStream.setFilePath( filePath );
                        }
                        fileStream.pipe( nextStream, { end : false } );
                        fileStream.on( 'error', cb );
                        fileStream.on( 'end', cb );
                    },
                    function( err ){
                        nextStream.end();
                    }
                );
            }
        ], function( err ){
            next( err === true ? null : err );
        });
    };
    
    // ------------------------------------------------------------------------------------------ //
    
    // Compare the last modified times from the source files to the destination file. If any of them
    // are newer than the destination then we need to recompile.
    function _compareTimes( sourceFiles, destinationFile, callback ){
        if( !Array.isArray( sourceFiles ) ){
            sourceFiles = [ sourceFiles ];
        }
        
        // Start by getting the mod time for the destination.
        fs.stat( destinationFile, function( err, destStat ){
            if( err ){
                return callback( err );
            }
            var destMTime = destStat.mtime.getTime();
            
            // Step through each source file and get their mod times.
            async.eachSeries(
                sourceFiles,
                function( filePath, cb ){
                    fs.stat( filePath, function( err, sourceStat ){
                        if( err ){
                            return cb( err );
                        }
                        if( sourceStat.mtime.getTime() > destMTime ){
                            cb( true ); // Short circuit out.
                        }
                        else {
                            cb();
                        }
                    });
                },
                function( err ){
                    callback( err !== true && err, err === true );
                }
            );
        });
    }

    // ------------------------------------------------------------------------------------------ //
    
    // Recurse through the source directory and gather all the files found.
    function _compileSourceList( sourcePath, callback ){
        async.waterfall([
            // First read all the file names in the source directory.
            function( cb ){ fs.readdir( sourcePath, cb ); },

            // Stat each of the files so we know which are directories.
            function( files, cb ){
                var filePaths = files.map( function( file ){ return path.join( sourcePath, file ); } );
                async.map( filePaths, fs.stat, function( err, fileStats ){
                    cb( err, filePaths, fileStats );
                });
            },

            // Filter the files and directories apart and then recurse into the directories.
            function( filePaths, fileStats, cb ){
                var goodFilePaths   = [];
                var directories     = [];
                for( var i = 0; i < fileStats.length; ++i ){
                    if( fileStats[ i ].isDirectory() ){
                        directories.push( filePaths[ i ] );
                    }
                    else if( !opts.extension || path.extname( filePaths[ i ] ) == opts.extension ){
                        goodFilePaths.push( filePaths[ i ] );
                    }
                }
                
                async.map( directories, _compileSourceList, function( err, sourceFiles ){
                    cb( err, goodFilePaths, sourceFiles );
                });
            },

            // Join all the file paths into one big array and finish.
            function( filePaths, subFilePaths, cb ){
                var outFiles = [];
                var push = outFiles.push;
                push.apply( outFiles, filePaths );
                for( var i = 0; i < subFilePaths.length; ++i ){
                    push.apply( outFiles, subFilePaths[ i ] );
                }
                cb( null, outFiles );
            }
        ], callback );
    }
};
