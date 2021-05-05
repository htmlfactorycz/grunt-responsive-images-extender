/*
 * grunt-responsive-images-extender
 * https://github.com/htmlfactorycz/grunt-responsive-images-extender
 *
 * Copyright (c) 2020 Vitalij Petráš
 * Licensed under the MIT license.
 */

module.exports = function(grunt) {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var cheerio = require('cheerio');
  var sizeOf = require('image-size');

  var DEFAULT_OPTIONS = {
    separator: '@',
    baseDir: '',
    ignore: [],
    webp: false,
    maxsize: 500
  };

  grunt.registerMultiTask('responsive_images_extender', 'Extend HTML image tags with srcset and sizes attributes to leverage native responsive images.', function() {
    var numOfFiles = this.files.length;
    var options = this.options(DEFAULT_OPTIONS);
    var imgCount = 0;

    var normalizeImagePath = function(src, filepath) {
      var pathPrefix;

      if (path.isAbsolute(src)) {
        pathPrefix = options.baseDir;
      }
      else {
        pathPrefix = path.dirname(filepath);
      }

      return path.parse(path.join(pathPrefix, src));
    };

    var findMatchingImages = function(path) {
      var files = fs.readdirSync(path.dir);

      return files.filter(function(filename) {
        //ignore if file extension is not what we need
        if(!filename.endsWith(path.ext)) {
          return false;
        }

        //ignore if before separator string is not same as path name
        if(path.name !== filename.split(options.separator)[0]) {
          return false;
        }

        //else return true
        return true;
      });
    };

    var buildSrcMap = function(imageNames, imagePath) {
      var srcMap = {};

      imageNames.forEach(function(imageName) {
        srcMap[imageName] = sizeOf(path.join(imagePath.dir, imageName)).width;
      });

      return srcMap;
    };

    var buildSrcset = function(srcMap, imgSrc) {
      var srcset = [];
      var candidate;

      for (var img in srcMap) {
        candidate = path.posix.join(path.dirname(imgSrc), img);
        candidate += ' ' + srcMap[img] + 'w';
        srcset.push(candidate);
      }

      return srcset.join(', ');
    };

    var buildSizes = function(size) {
      return `(max-width: ${size}px) 100vw, ${size}px`;
    };

    var buildSrc = function (imagePath, maxsize, srcMap, imgSrc) {
      var nearestImageSize = Object.keys(srcMap).map(function (k) {
        return [k, srcMap[k]];
      }).reduce(function (prev, curr) {
        return (Math.abs(curr[1] - maxsize) < Math.abs(prev[1] - maxsize) ? curr : prev);
      });

      return path.posix.join(path.dirname(imgSrc), nearestImageSize[0]);
    };

    var processImage = function (imgElem, filepath, $) {
      var picture = null;
      var imgSrc = imgElem.attr('src');

      var process = function (imgSrc, filepath) {
        var imagePath = normalizeImagePath(imgSrc, filepath);
        var imageMatches = findMatchingImages(imagePath);

        switch (imageMatches.length) {
          case 0:
            grunt.verbose.error('Found no file for ' + imgSrc.cyan);
            return;
          case 1:
            grunt.verbose.error('Found only one file for ' + imgSrc.cyan);
            return;
          default:
            grunt.verbose.ok('Found ' + imageMatches.length.cyan + ' files for ' + imgSrc.cyan + ': ' + imageMatches);
        }

        if (imageMatches.length) {
          if (!picture && options.webp) {
            picture = '<picture>';
          }

          var srcMap = buildSrcMap(imageMatches, imagePath);
          var maxsize = imgElem.attr('maxsize') !== undefined ? imgElem.attr('maxsize') : options.maxsize;

          if (options.webp) {
            picture += '<source srcset="' + buildSrcset(srcMap, imgSrc) + '" sizes="' + buildSizes(maxsize) + '" type="image/' + imagePath.ext.split('.').pop() + '">';
          }

          //zmenime nativni obrazek (dats-srcset, smallestImageSrc)
          if ('.webp' !== imagePath.ext) {
            imgElem.attr('srcset', buildSrcset(srcMap, imgSrc));
            imgElem.attr('sizes', buildSizes(maxsize));
            imgElem.attr('src', buildSrc(imagePath, maxsize, srcMap, imgSrc));
          }
        }
      };

      if (options.webp) {
        var splittedSrc = imgSrc.split(".");
        splittedSrc[splittedSrc.length - 1] = 'webp';
        var webpImgSrc = splittedSrc.join('.');

        process(webpImgSrc, filepath);
      }

      process(imgSrc, filepath);

      imgElem.removeAttr('maxsize');

      //pokud mame povoleny format webp a jeho verze dopnime chybejici operace
      if (picture) {
        picture += '</picture>';
        imgElem.after(picture);

        var lazyPicture = imgElem.next('picture');
        lazyPicture.append(imgElem);
        imgElem = lazyPicture;
      }
    };

    var parseAndExtendImg = function(filepath) {
      var content = grunt.file.read(filepath);
      var $ = cheerio.load(content, {decodeEntities: false});
      var imgElems = $('img:not(' + options.ignore.join(', ') + ')');

      imgElems.each(function() {
        var imgElem = $(this);
        var hasSrcset = imgElem.attr('data-srcset') !== undefined;

        if (!hasSrcset) {
          processImage(imgElem, filepath, $);
        }
      });

      return {content: $.html(), count: imgElems.length};
    };

    this.files.forEach(function(file) {
      var contents = file.src.filter(function(filepath) {
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function(filepath) {
        var result = parseAndExtendImg(filepath);
        imgCount += result.count;
        return result.content;
      }).join('\n');

      grunt.file.write(file.dest, contents);
    });

    grunt.log.ok('Processed ' + imgCount.toString().cyan + ' <img> ' + grunt.util.pluralize(imgCount, 'tag/tags'));
  });

};
