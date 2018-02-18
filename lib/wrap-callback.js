/**
 * adds an callback param to the original function
 */
module.exports = function wrapCallback(fn) {
    return function (...args) {
        let cb;
        if (typeof args[args.length - 1] === 'function') {
            cb = args[args.length - 1];
            args.pop();
        }

        const promise = fn.apply(this, args);

        if (typeof cb === 'function') {
            promise.then(value => setImmediate(cb, null, value), err => setImmediate(cb, err));
        }

        return promise;
    };
};