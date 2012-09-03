
exports.defaultOptions = function( compiler, opts ){
    opts            = opts      || {};
    opts.compiler   = compiler;
    opts.src        = opts.src  || '';
    opts.dest       = opts.dest || opts.src;
}
