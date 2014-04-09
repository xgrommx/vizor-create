var gulp = require('gulp');
var rimraf = require('gulp-rimraf');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var jsonminify = require('gulp-jsonminify');

var src = 'browser'
var dist = 'dist'

gulp.task('clean', function() {
	gulp.src(dist+'/**', { read: false })
		.pipe(rimraf())
});

gulp.task('concat-js', function() {
	return gulp.src([
		src+'/vendor/*.js',
		src+'/scripts/*.js',
		src+'/plugins/*.js'
	])
	.pipe(concat('js/engi.js'))
	.pipe(uglify())
	.pipe(gulp.dest(dist))
});

gulp.task('concat-css', function() {
	return gulp.src([
		src+'/plugins/**/*.css',
		src+'/style/**/*.css'
	])
	.pipe(concat('css/engi.css'))
	// .pipe(uglify())
	.pipe(gulp.dest(dist))
});

gulp.task('copy-presets', function() {
	return gulp.src(src+'/presets/*.json')
		.pipe(gulp.dest(dist+'/presets'))
});

gulp.task('copy-plugin-catalogue', function() {
	return gulp.src(src+'/plugins/plugins.json')
		.pipe(gulp.dest(dist+'/plugins'))
});

gulp.task('default', [
	'clean',
	'concat-js',
	'copy-presets',
	'copy-plugin-catalogue',
	'concat-css'
]);
