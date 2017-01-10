// Based on https://github.com/knownasilya/hapi-decorators (0.4.3)

const extend = require('extend');
const find = require('lodash.find');

// const debug = require('debug')('hapi-decorators');
// const debug = console.log;
const debug = () => {
};

const routeMethods = {
    get: 'get',
    post: 'post',
    put: 'put',
    delete: 'delete',
    patch: 'patch',
    all: '*'
};

exports.controller = function controller(baseUrl) {
    return function (target) {
        target.prototype.baseUrl = baseUrl;

        target.prototype.routes = function () {
            let self = this;
            let base = trimslash(this.baseUrl);

            debug('Pre-trim baseUrl: %s', this.baseUrl);
            debug('Post-trim baseUrl: %s', base);

            if (!this.rawRoutes) {
                return []
            }

            return this.rawRoutes.map(function (route) {
                if (!route.path) {
                    throw new Error('Route path must be set with `@route` or another alias')
                }

                debug('Route path before merge with baseUrl: %s', route.path);
                let url = (base + trimslash(route.path)) || '/';

                let hapiRoute = extend({}, route);

                hapiRoute.path = url;
                hapiRoute.config.bind = self;

                return hapiRoute
            })
        }
    }
};

function route(method, path) {
    debug('@route (or alias) setup');
    return function (target, key, descriptor) {
        let targetName = target.constructor.name;
        let routeId = targetName + '.' + key;

        let origFn = descriptor.value;
        descriptor.value = (function (request, reply) {
            try {
                return origFn(request, reply)
            } catch (e) {
                console.error("Unhandled error on route " + routeId, descriptor.value.name + '()', e);
            }
        }).bind(target);

        setRoute(target, key, {
            method: method,
            path: path,
            config: {
                id: routeId
            },
            handler: descriptor.value,
        });

        return descriptor
    }
}

exports.route = route;

// Export route aliases
Object.keys(routeMethods).forEach(function (key) {
    exports[key] = route.bind(null, routeMethods[key])
});

function config(config) {
    debug('@config setup');
    return function (target, key, descriptor) {
        setRoute(target, key, {
            config: config
        });

        return descriptor
    }
}

exports.config = config;

function validate(config) {
    debug('@validate setup');
    return function (target, key, descriptor) {
        setRoute(target, key, {
            config: {
                validate: config
            }
        });

        return descriptor
    }
}

exports.validate = validate;

function cache(cacheConfig) {
    debug('@cache setup');
    return function (target, key, descriptor) {
        setRoute(target, key, {
            config: {
                cache: cacheConfig
            }
        });

        return descriptor
    }
}

exports.cache = cache;

function setRoute(target, key, value) {
    if (!target.rawRoutes) {
        target.rawRoutes = []
    }

    let targetName = target.constructor.name;
    let routeId = targetName + '.' + key;
    let defaultRoute = {
        config: {
            id: routeId
        }
    };
    let found = find(target.rawRoutes, 'config.id', routeId);

    if (found) {
        debug('Subsequent configuration of route object for: %s', routeId);
        extend(true, found, value)
    } else {
        debug('Initial setup of route object for: %s', routeId);
        target.rawRoutes.push(extend(true, defaultRoute, value))
    }
}

function trimslash(s) {
    return s[s.length - 1] === '/' ? s.slice(0, s.length - 1) : s
}