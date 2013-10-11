
var async   = require( 'async' );
var fs      = require( 'fs' );
var path    = require( 'path' );

var util = module.exports = {
    cleanDirectory : function( directory, callback ){
        async.waterfall([
            function( cb ){ fs.readdir( directory, cb ); },
            function( subFiles, cb ){
                var filePaths = subFiles.map( function( file ){ return path.join( directory, file ); } );
                async.map( filePaths, fs.stat, function( err, fileStats ){
                    cb( err, filePaths, fileStats );
                });
            },
            function( filePaths, fileStats, cb ){
                var files = filePaths.map( function( path, i ){ return { path : path, stat : fileStats[ i ] }; } );
                async.each( files, function( file ){
                    if( file.stat.isDirectory() ){
                        util.cleanDirectory( file.path, cb );
                    }
                    else {
                        fs.unlink( file.path, cb );
                    }
                }, cb );
            }
        ], callback );
    }
};
