/*
 * grunt-responsive-images-extender
 * https://github.com/htmlfactorycz/grunt-responsive-images-extender
 *
 * Copyright (c) 2020 Vitalij Petráš
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    jshint: {
      all: [
        'Gruntfile.js',
        'tasks/*.js',
        '<%= nodeunit.tests %>'
      ],
      options: {
        jshintrc: '.jshintrc'
      }
    },

    // Before generating any new files, remove any previously-created files.
    clean: {
      tests: ['test/testing-processed.html']
    },

    // Four example configurations to be run (and then tested)
    responsive_images_extender: {
      all: {
        options: {
          separator: "@",
          webp: true,
          ignore: [
            "img[srcset]",
            "img[src^='http']",
            "img[src^='data:']",
            "img[data-srcset]",
          ], //"img[sizes]", "img[srcset]"
        },
        files: [{
          src: ['test/testing.html'],
          dest: 'test/testing-processed.html'
        }]
      },
    },

    // Unit tests.
    nodeunit: {
      tests: ['test/*_test.js']
    }

  });

  // Actually load this plugin's task(s).
  grunt.loadTasks('tasks');

  // These plugins provide necessary tasks.
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-nodeunit');

  // Whenever the "test" task is run, first clean the "tmp" dir, then run this
  // plugin's task(s), then test the result.
  grunt.registerTask('test', ['clean', 'responsive_images_extender', 'nodeunit']);

  // By default, lint and run all tests.
  grunt.registerTask('default', ['jshint', 'test']);

};
