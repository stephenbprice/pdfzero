const gulp = require('gulp');
const browsersync = require('browser-sync').create();
const del = require('del');

function clean () {
  return del(['./docs/*']);
}

function browserSync (done) {
  browsersync.init({
    server: {
      baseDir: './docs'
    },
    port: 3000
  });
  done();
}

function browserSyncReload (done) {
  browsersync.reload();
  done();
}

function css (done) {
  gulp.src('./src/css/*.css')
    .pipe(gulp.dest('./docs/css'))
    .pipe(browsersync.stream())
  ;
  done();
}

function js (done) {
  gulp.src('./src/js/*.js')
    .pipe(gulp.dest('./docs/js'))
    .pipe(browsersync.stream())
  ;
  done();
}

function html (done) {
  gulp.src('./src/*.html')
    .pipe(gulp.dest('./docs'))
    .pipe(browsersync.stream())
  ;
  done();
}

function images (done) {
  gulp.src('./src/assets/*')
    .pipe(gulp.dest('./docs/assets'))
    .pipe(browsersync.stream())
  ;
  done();
}

function watchFiles () {
  gulp.watch('./src/css/*.css', css);
  gulp.watch('./src/js/*.js', js);
  gulp.watch('./src/*.html', html);
  gulp.watch('./src/images/*', images);
}

const build = gulp.series(clean, gulp.parallel(css, js, html, images));
const watch = gulp.series(build, gulp.parallel(watchFiles, browserSync));

exports.clean = clean;
exports.css = css;
exports.js = js;
exports.html = html;
exports.images = images;
exports.build = build;
exports.watch = watch;
