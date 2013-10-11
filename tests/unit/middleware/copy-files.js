/* global : describe, it, beforeEach */

var should      = require( 'should' );
var compiler    = require( '../../../' );
var path        = require( 'path' );
var fs          = require( 'fs' );
var util        = require( '../../resources/util.js' );

const SOURCE_DIR        = path.normalize( __dirname + '../../../resources/source/' );
const DESTINATION_DIR   = path.normalize( __dirname + '../../../resources/destination/' );

describe( 'Resource Compiler', function(){
    describe( 'middleware', function(){

        beforeEach(function( done ){
            util.cleanDirectory( DESTINATION_DIR, done );
        });

        it( 'should copy a single file', function( done ){
            try {
                fs.unlinkSync( DESTINATION_DIR + 'a.js' );
            }
            catch( e ){}
            
            var middleware = compiler({
                source      : SOURCE_DIR,
                destination : DESTINATION_DIR
            });
            
            middleware( { path : 'js/a.js', route : { path : '/js' } }, {}, function( err ){
                should.not.exist( err );
                
                fs.existsSync( DESTINATION_DIR + 'a.js' ).should.be.true;
                done();
            });
        });
    });
});
