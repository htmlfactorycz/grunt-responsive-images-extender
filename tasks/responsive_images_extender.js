/*
 * grunt-responsive-images-extender
 * https://github.com/smaxtastic/grunt-responsive-images-extender
 *
 * Copyright (c) 2014 Stephan Max
 * Licensed under the MIT license.
 *
 * Extend HTML image tags with srcset and sizes attributes to leverage native responsive images.
 *
 * @author Stephan Max (http://stephanmax.is)
 * @version 2.0.0
 */

module.exports = function(grunt) {
  'use strict';

  var fs = require('fs');
  var path = require('path');
  var cheerio = require('cheerio');
  var sizeOf = require('image-size');

  var DEFAULT_OPTIONS = {
    separator: '-',
    baseDir: '',
    ignore: [],
    srcsetAttributeName: 'srcset',
    webp: false
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
      var imageMatch = new RegExp(path.name + '(' + options.separator + '[^' + options.separator + ']*)?' + path.ext + '$');

      return files.filter(function(filename) {
        return imageMatch.test(filename);
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

    var buildSizes = function(sizeList) {
      var sizes = [];

      sizeList.forEach(function(s) {
        var actualSize = srcMap[imagePath.name + imagePath.ext] + 'px';
        var cond = s.cond.replace('%size%', actualSize);
        var size = s.size.replace('%size%', actualSize);

        sizes.push(
          cond === 'default' ? size : '(' + cond + ') ' + size
        );
      });

      return sizes.join(', ');
    };

    var getSmallestImage = function(srcMap) {
      var smallestImage = Object.keys(srcMap).map(function(k) {
        return [k, srcMap[k]];
      }).reduce(function(a, b) {
        return b[1] < a[1] ? b : a;
      });

      return smallestImage;
    };

    var processImage = function (imgElem, filepath, $) {
      var picture = null;
      var lazyloadThisImage = false;
      var imgSrc = imgElem.attr('src');

      var process = function(imgSrc, filepath){
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
          lazyloadThisImage = true;
          if (!picture && options.webp) picture = '<picture>';

          var srcMap = buildSrcMap(imageMatches, imagePath);
          var smallestImage = getSmallestImage(srcMap);
          var smallestImageSrc = path.posix.join(path.dirname(imgSrc), smallestImage[0]);

          //base64 if smaller or equal to 10
          if(smallestImage[1] <= 10){
            smallestImageSrc = 'data:image/' + smallestImageSrc.substr(smallestImageSrc.lastIndexOf('.') + 1) + ';base64,' + Buffer.from(grunt.file.read(imagePath.dir + '/' + smallestImage[0], { encoding: null })).toString('base64');
          }

          if (options.webp) {
            picture += '<source srcset="' + smallestImageSrc + '" data-srcset="' + buildSrcset(srcMap, imgSrc) + '" type="image/' + imagePath.ext.split('.').pop() + '">';
          }

          //zmenime nativni obrazek (dats-srcset, smallestImageSrc)
          if ('.webp' !== imagePath.ext) {
            imgElem.attr('data-srcset', buildSrcset(srcMap, imgSrc));
            imgElem.attr('src', smallestImageSrc);
          }
        }
      }

      if(options.webp){
        var splittedSrc = imgSrc.split(".");
        splittedSrc[splittedSrc.length - 1] = 'webp';
        var webpImgSrc = splittedSrc.join('.');

        process(webpImgSrc, filepath);
      }

      process(imgSrc, filepath);

      //pokud mame povoleny format webp a jeho verze dopnime chybejici operace
      if (picture) {
        picture += '</picture>';
        imgElem.after(picture);

        var lazyPicture = imgElem.next('picture');
        lazyPicture.append(imgElem);
        imgElem = lazyPicture;
      }

      //pokud obrazek ma srcset udelame z nej lazyimage
      if (lazyloadThisImage) {
        imgElem.after('<noscript></noscript>');
        var noscript = imgElem.next('noscript');

        noscript.append(imgElem.clone());
        imgElem.addClass('lazyload');

        noscript.find('source').each(function () {
          $(this).attr('srcset', $(this).attr('data-srcset'));
          $(this).removeAttr('data-srcset');
        });

        noscript.find('img').each(function () {
          $(this).attr('srcset', $(this).attr('data-srcset'));
          $(this).removeAttr('data-srcset');
        });
      }
    }

    var parseAndExtendImg = function(filepath) {
      var content = grunt.file.read(filepath);
      var $ = cheerio.load(content, {decodeEntities: false});
      var imgElems = $('img:not(' + options.ignore.join(', ') + ')');

      imgElems.each(function() {
        var imgElem = $(this);
        var hasSrcset = imgElem.attr('data-srcset') !== undefined;

        if (!hasSrcset) processImage(imgElem, filepath, $);
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