/*=====================================================================*/
/*                  Gulp with Tailwind Utility framework               */
/*=====================================================================*/

const {src, dest, task, watch, series, parallel} = require('gulp');
const cacheVersion = { addSuffix: '?v=' + new Date().getTime() }; // Cache destroy for new live releases 

const options = require("./package.json").options; //Options : paths and other options from package.json
const browserSync = require('browser-sync').create();

const gulpsmith = require('gulpsmith');
const twig = require('metalsmith-twig');
const handlebars = require('metalsmith-handlebars');
const layouts = require('metalsmith-layouts');
const discoverPartials = require('metalsmith-discover-partials');
const discoverHelpers = require('metalsmith-discover-helpers');
const metalrename = require("metalsmith-rename");
const sitemap = require('metalsmith-mapsite');
const permalinks = require('metalsmith-permalinks');
const collections = require('metalsmith-collections');

gulp_front_matter = require('gulp-front-matter');
assign = require('lodash.assign');
const merge = require('lodash.merge');

const fs = require('fs');
const yaml = require('js-yaml');
const sass = require('gulp-sass'); //For Compiling SASS files
const concat = require('gulp-concat'); //For Concatinating js,css files
const postcss = require('gulp-postcss'); //For Compiling tailwind utilities with tailwind config
const purify = require('gulp-purifycss');//To remove unused CSS 
const uglify = require('gulp-uglify');//To Minify JS files
const imagemin = require('gulp-imagemin'); //To Optimize Images
const purgecss = require('gulp-purgecss'); //To Remove Unsued CSS
const minifycss = require('gulp-clean-css');//To Minify CSS files
const del = require('del'); //For Cleaning dist for fresh builds
const logSymbols = require('log-symbols'); //For Symbolic Console logs
const rename = require('gulp-rename'); // Rename files with min suffix
const htmlReplace = require('gulp-html-replace'); //Replace CSS/JS html includes with min versions
const htmlmin = require('gulp-htmlmin'); //To Minify HTML files

// Set the browser that you want to support
const AUTOPREFIXER_BROWSERS = [
  'ie >= 10',
  'ie_mob >= 10',
  'ff >= 30',
  'chrome >= 34',
  'safari >= 7',
  'opera >= 23',
  'ios >= 7',
  'android >= 4.4',
  'bb >= 10'
];

//const config = yaml.safeLoad(fs.readFileSync('config.yml', 'utf-8'));
const config = yaml.load(fs.readFileSync('config.yml', 'utf-8'));

//Load Previews on Browser on dev
task('livepreview', (done) => {
    browserSync.init({
        server: {
            baseDir: options.paths.dist.base
        },
        port: 1234
    });
    done();
});

//Reload functions which triggers browser reload
function previewReload(done) {
    console.log("\n\t" + logSymbols.info, "Reloading Preview.\n");
    browserSync.stream();
    done();
}

// Copy html to hbs for layouts or handlebars via metalsmith layouts doesn't work
task('copy-layouts', () => {
    return src(options.paths.src.metalsmith.layouts + '/**/*.html')
        .pipe(rename(function(path) {
            path.extname = '.hbs';
        }))
        .pipe(dest(options.paths.src.metalsmith.layouts));
});

task('dev-html', () => {
    return src([
        options.paths.src.metalsmith.pages + '/**/*.html', 
        options.paths.src.metalsmith.collections + '/**/*.html'
    ])
    .pipe(gulp_front_matter()).on("data", function(file) {
        assign(file, file.frontMatter); 
        delete file.frontMatter;
    })
    .pipe(
        gulpsmith(options.paths.src.metalsmith.root)
        .metadata(merge({
                site: {
                    copyright: '&COPY; ' + (new Date()).getFullYear()
                }
            },
            config.metalsmith.metadata
        ))
        .use(discoverPartials({
            directory: './partials',
            pattern: /\.html$/
          }))
          .use(discoverHelpers({
            directory: './helpers',
            pattern: /\.js$/
          }))
        .use(layouts({
            "engine": "handlebars",
            "engineOptions": {
                extname: '.html'
            },
            "default": "default.hbs",
            "directory": "./layouts",
            "pattern": "**/*.html",
            "partials": './partials',
            "partialExtension": ".html",
            "rename": true,
            "suppressNoFilesError": true
        }))
        .use(collections(config.metalsmith.collections))
        .use(permalinks(config.metalsmith.permalinks))
        .use(sitemap(config.metalsmith.sitemap))
    )
    .pipe(dest(options.paths.dist.base));
}); 

// Copy Delete hbs for layouts
task('del-layouts', (done) => {
    del.sync([
        options.paths.src.metalsmith.layouts + '/**/*.hbs', 
        '!' + options.paths.src.metalsmith.layouts
    ]);
    done();
});

//Production version cache and minification of HTML
task('build-html', () => {
    return src(options.paths.dist.base+'/**/*.html')
        .pipe(htmlReplace({
            css: '/css/styles.min.css' + cacheVersion.addSuffix,
            js: '/js/scripts.min.js' + cacheVersion.addSuffix
        }))
        .pipe(htmlmin({ collapseWhitespace: true }))
        .pipe(dest(options.paths.dist.base));
}); 

//Compiling styles
task('dev-styles', () => {
    var tailwindcss = require('tailwindcss'); 
    return src(options.paths.src.css + '/**/*')
        .pipe(sass().on('error', sass.logError))
        .pipe(postcss([
            tailwindcss(options.config.tailwindjs),
            require('autoprefixer')
        ]))
        .pipe(concat({ path: 'styles.css'}))
        .pipe(dest(options.paths.dist.css));
});

//Compiling styles
task('build-styles', () => {
    return src([
        options.paths.dist.css + '/**/*.css', 
        '!' + options.paths.dist.css + '/**/*.min.css'
    ])
    .pipe(purgecss({
        content: ["src/**/*.html","src/**/*.hbs","src/**/.*js"],
        whitelist: ['html', 'body'],
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || []
    }))
    .pipe(minifycss({
        compatibility: 'ie8'
    }))
    .pipe(rename({
        suffix: '.min'
    }))
    .pipe(dest(options.paths.dist.css));
});

//merging all script files to a single file
task('dev-scripts', () => {
    return src([
        options.paths.src.js + '/libs/**/*.js',
        options.paths.src.js + '/**/*.js'
    ])
    .pipe(concat({ path: 'scripts.js'}))
    .pipe(dest(options.paths.dist.js));
});


//merging all script files to a single file
task('build-scripts', () => {
    return src([
        options.paths.src.js + '/libs/**/*.js',
        options.paths.src.js + '/**/*.js'
    ])
    .pipe(concat({ path: 'scripts.min.js'}))
    .pipe(uglify())
    .pipe(dest(options.paths.dist.js));
});

task('dev-imgs', (done) => {
    src(options.paths.src.img + '/**/*')
    .pipe(dest(options.paths.dist.img));
    done();
});

task('build-imgs', (done) => {
    src(options.paths.src.img + '/**/*')
    .pipe(imagemin())
    .pipe(dest(options.paths.dist.img));
    done();
});

task('dev-assets', (done) => {
    src(options.paths.src.assets + '/**/*')
    .pipe(dest(options.paths.dist.base));
    done();
});

//Watch files for changes
task('watch-changes', (done) => {

    //Watching HTML Files edits
    watch(options.config.tailwindjs,series('dev-styles', function (done) {
    browserSync.reload();
    done();
  }));

    //Watching HTML Files edits
    watch(options.paths.src.base+'/**/*.html',series('dev-styles','copy-layouts', 'dev-html', 'del-layouts', function (done) {
    browserSync.reload();
    done();
  }));

    //Watching css Files edits
    watch(options.paths.src.css+'/**/*',series('dev-styles', function (done) {
    browserSync.reload();
    done();
  }));

    //Watching JS Files edits
    watch(options.paths.src.js+'/**/*.js',series('dev-scripts', function (done) {
    browserSync.reload();
    done();
  }));

    //Watching Img Files updates
    watch(options.paths.src.img+'/**/*',series('dev-imgs', function (done) {
    browserSync.reload();
    done();
  }));

    console.log("\n\t" + logSymbols.info,"Watching for Changes made to files.\n");

    done();
});

//Cleaning dist folder for fresh start
task('clean:dist', () => {
    console.log("\n\t" + logSymbols.info, "Cleaning dist folder for fresh start.\n");
    return del(['dist']);
});

//series of tasks to run on dev command
task('development', series('clean:dist', 'copy-layouts', 'dev-html', 'del-layouts', 'dev-styles', 'dev-scripts', 'dev-imgs', 'dev-assets', (done) => {
    console.log("\n\t" + logSymbols.info, "npm run dev is complete. Files are located at ./dist\n");
    done();
}));

task('production', series('development', 'build-styles', 'build-scripts', 'build-imgs', 'build-html', (done) => {
    console.log("\n\t" + logSymbols.info, "npm run build is complete.\n");
    done();
}));

exports.default = series('development', 'livepreview', 'watch-changes');
exports.build = series('production');