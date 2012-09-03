
var stream  = require( 'stream' );
var util    = require( 'util' );
var fs      = require( 'fs' );

var CombineStream = (function(){

    function CombineStream( sourceStreams ){
        this.readable       = true;
        this._streams       = sourceStreams;
        this._activeStream  = 0;
        this._bufferedData  = new Array( sourceStreams.length );

        for( var i = 0; i < sourceStreams.length; ++i ){
            var stream = sourceStreams[ i ];
            stream
                .on( 'data',    _streamData.bind( this, i )     )
                .on( 'error',   _streamError.bind( this, i )    )
                .on( 'end',     _streamEnd.bind( this, i )      )
                .on( 'close',   _streamClose.bind( this, i )    )
                .pause();
        }

        _startNextStream.call( this );
    }
    util.inherits( CombineStream, stream.Stream );

    var CombineStreamProto = CombineStream.prototype;

    function _forEachSource( funcName ){
        return function(){
            for( var i = 0; i < this._streams.length; ++i ){
                var stream = this._streams[ i ];
                stream[ funcName ].apply( stream, arguments );
            }
        }
    }

    function _streamData( index, data ){
        if( this._activeStream == index ){
            this.emit( 'data', data );
        }
        else {
            if( !this._bufferedData[ index ] ){
                this._bufferedData[ index ] = '';
            }
            this._bufferedData[ index ] += Buffer.isBuffer( data ) ? data.toString() : data;
        }
    }

    function _streamError( index, err ){
        this.destroy();
        this.emit( 'error', err );
    }

    function _streamEnd( index ){
        if( this._activeStream == index ){
            if( ++this._activeStream >= this._streams.length ){
                this.emit( 'end' );
            }
            else {
                _startNextStream.call( this );
            }
        }
    }

    function _streamClose( index ){
        this._streams[ index ].destroy();
        _streamEnd.call( this, index );
    }

    function _startNextStream(){
        if( this._streams[ this._activeStream ].readable ){
            this._streams[ this._activeStream ].resume();
        }
        else {
            _streamEnd.call( this, this._activeStream );
        }
    }

    CombineStreamProto.setEncoding = _forEachSource.call( this, 'setEncoding' );

    CombineStreamProto.pause = function(){
        this._streams[ this._activeStream ].pause();
    };

    CombineStreamProto.resume = function(){
        this._streams[ this._activeStream ].resume();
    };

    CombineStreamProto.destroy = function(){
        _forEachSource.call( this, 'removeAllListeners' ).call( this, 'data' );
        _forEachSource.call( this, 'removeAllListeners' ).call( this, 'error' );
        _forEachSource.call( this, 'removeAllListeners' ).call( this, 'end' );
        _forEachSource.call( this, 'removeAllListeners' ).call( this, 'close' );
        _forEachSource.call( this, 'destroy' ).call( this );
        this.readable = false;
    };

    return CombineStream;
})();

module.exports = CombineStream;
exports.CombineStream = CombineStream;

expors.combineFiles = function( files, opts ){
    var fileStreams = [];
    for( var i = 0; i < files.length; ++i ){
        fileStreams.push( fs.createReadStream( files[ i ], opts ) );
    }
    return new CombineStream( fileStreams );
};
