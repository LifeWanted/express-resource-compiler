express-resource-compiler
=========================

A generic resource compiler meant for use with Express.

### Usage ###

#### compiler ####

The `compiler` middleware will run any data read in through the asyncronous `compile` function and
then save the results to the `dest` directory. If the source file has not changed, then the compiler
will immediately call `next` to allow the next middleware (such as `static`) to finish handling the
request, otherwise the `compile` function is called with an `inputStream` and `outputStream`. When
the `outputStream` ends (emits the `end` event) then `next` will be called so the next middleware
can finish the request.

##### Options #####

```js
{
    'src'       : // The directory to read files from.
    'dest'      : // The directory to save files to.
    'compile'   : // A function to run files through before saving them to disk.
}
```

##### Example #####

```js

var app         = require( 'express' )();
var compiler    = require( 'resource-compiler' ).compiler;

// Set up the compiler middleware.
app.use( '/scripts', compiler({
    src     : __dirname + '/scripts',
    dest    : __dirname + '/static/scripts',
    compile : function( outputStream, inputStream ){
        // Read in data from input and write it to output.
        inputStream.pipe( outputStream );
    }
}));

// Use static to then serve the data to the client.
app.use( '/scripts', express.static( __dirname + '/static/scripts' ) );

```

#### combiner ####

The `combiner` middleware will read everything in a directory, combine it into one file, and save it
to a file somewhere else.

##### Options #####

```js
{
    'src'   : // The directory to read files from.
    'dest'  : // The directory to save files to.
    'ext'   : // The file extension to look for when combining files.
}
```

##### Example #####

This example sets up the combiner to read in files from the `__dirname + '/scripts'`, combine any
with the extension `.js` and write them to the `__dirname + '/static/scripts'` directory. Note that
files will be combined alphabetically by file name, so `a-file.js` will come before `z-file.js`.

```js

var app         = require( 'express' )();
var combiner    = require( 'resource-compiler' ).combiner;

// Set up the combiner middleware.
app.use( '/scripts', combiner({
    src     : __dirname + '/scripts',
    dest    : __dirname + '/static/scripts',
    ext     : '.js'
}));

// Use static to then serve the data to the client.
app.use( '/scripts', express.static( __dirname + '/static/scripts' ) );

```

If you had the directory structure:

```
    - scripts/
        - app/
            - app.js
            - ignored.json
            - someFile.js
            - widgets/
                - awesomeWidget.js
                - coolestWidgetEver.js
        - /lib
            - angular.js
            - jQuery.js
            - lib.js
```

And a request of `GET /scripts/app.js` came in, the combiner would read in the files, in this order:

  - /scripts/app/app.js
  - /scripts/app/someFile.js
  - /scripts/app/widgets/awesomeWidget.js
  - /scripts/app/widgets/coolestWidgetEver.js

Then combine them into one stream and save that to `/static/scripts/app.js`. Notice that the file
`/scipts/app/ignored.json` will __not__ be combined in the final script and that the directory
`/scripts/app/widgets` was recursed into and each `.js` file added as well.













