var path = require('path')
var jade = require('jade');
var _ = require('lodash');
var async = require('async');
var fs = require('fs-extra');
var outDir = 'public';
var buildy = {};

var isDev = process.env.NODE_ENV === 'development';
var doPretty = isDev ? true : false;

var clean = function(cb) {
    cb = cb || _.noop;
    fs.remove(outDir, function(err) {
        if (err) return cb(err);
        fs.mkdir(outDir, cb);
    });
};

var copyAssets = function(cb) {
    fs.copy('src/css', 'public/css', function (err) {
        if (err) return cb(err)
        fs.copy('src/images', 'public/images', cb);
    });
}

var compileIndex = function(cb) {
    cb = cb || _.noop;
    var indexFilename = path.resolve('src/index.jade');
    var html = jade.compile(fs.readFileSync(indexFilename), {
        filename: indexFilename,
        pretty: doPretty,
        cache: false
    })({
        reviews: [1, 2],// buildy.reviews.data,
        "books": ["A", "B", "C"]
    });
    fs.writeFile(
        path.join(outDir, 'index.html'),
        html,
        cb
    );
};

var compileReviews = function(cb) {
    cb = cb || _.noop;
    buildy.reviews = {
        stats: [],
        data: []
    };
    fs.walk(path.resolve(__dirname, 'src', 'manifests'))
    .on('data', function(item) {
        if (item.path.match(/\.json$/)) return buildy.reviews.stats.push(item);
        console.warn('ignoring', item.path);
    })
    .on('end', function() {
        try { jadeifyReviews(); }
        catch(err) { return cb(err); }
        cb();
    });

    var jadeifyReviews = function() {
        var reviewFilename = path.resolve('src/review.jade');
        var compileReview = jade.compile(fs.readFileSync(reviewFilename), {
            filename: reviewFilename,
            pretty: doPretty,
            cache: false
        });
        var paths = buildy.reviews.stats.map(function(stat) { return stat.path });
        for (var i = paths.length - 1; i >= 0; i--) {
            var _path = paths[i];
            var review = require(_path);
            buildy.reviews.data.push(review);
            if (!review.name) throw new ReferenceError('missing review name', review);
            review.subtitle = review.name;
            fs.writeFileSync(
                path.join(outDir, 'review-' + _.kebabCase(review.name)) + '.html',
                compileReview(review)
            );
        };
    };
};

// run the build!
async.series(
    [ clean, copyAssets, compileReviews, compileIndex ],
    function(err) {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        console.log('build success');
    }
);