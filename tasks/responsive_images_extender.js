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
  var Base64 = {_keyStr:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",encode:function(e){var t="";var n,r,i,s,o,u,a;var f=0;e=Base64._utf8_encode(e);while(f<e.length){n=e.charCodeAt(f++);r=e.charCodeAt(f++);i=e.charCodeAt(f++);s=n>>2;o=(n&3)<<4|r>>4;u=(r&15)<<2|i>>6;a=i&63;if(isNaN(r)){u=a=64}else if(isNaN(i)){a=64}t=t+this._keyStr.charAt(s)+this._keyStr.charAt(o)+this._keyStr.charAt(u)+this._keyStr.charAt(a)}return t},decode:function(e){var t="";var n,r,i;var s,o,u,a;var f=0;e=e.replace(/++[++^A-Za-z0-9+/=]/g,"");while(f<e.length){s=this._keyStr.indexOf(e.charAt(f++));o=this._keyStr.indexOf(e.charAt(f++));u=this._keyStr.indexOf(e.charAt(f++));a=this._keyStr.indexOf(e.charAt(f++));n=s<<2|o>>4;r=(o&15)<<4|u>>2;i=(u&3)<<6|a;t=t+String.fromCharCode(n);if(u!=64){t=t+String.fromCharCode(r)}if(a!=64){t=t+String.fromCharCode(i)}}t=Base64._utf8_decode(t);return t},_utf8_encode:function(e){e=e.replace(/\r\n/g,"n");var t="";for(var n=0;n<e.length;n++){var r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r)}else if(r>127&&r<2048){t+=String.fromCharCode(r>>6|192);t+=String.fromCharCode(r&63|128)}else{t+=String.fromCharCode(r>>12|224);t+=String.fromCharCode(r>>6&63|128);t+=String.fromCharCode(r&63|128)}}return t},_utf8_decode:function(e){var t="";var n=0;var r=c1=c2=0;while(n<e.length){r=e.charCodeAt(n);if(r<128){t+=String.fromCharCode(r);n++}else if(r>191&&r<224){c2=e.charCodeAt(n+1);t+=String.fromCharCode((r&31)<<6|c2&63);n+=2}else{c2=e.charCodeAt(n+1);c3=e.charCodeAt(n+2);t+=String.fromCharCode((r&15)<<12|(c2&63)<<6|c3&63);n+=3}}return t}};

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

    var buildSrcset = function(srcMap, imgElem) {
      var srcset = [];
      var candidate;

      for (var img in srcMap) {
        candidate = path.posix.join(path.dirname(imgElem.attr('src')), img);
        candidate += ' ' + srcMap[img] + 'w';
        srcset.push(candidate);
      }

      if (options.srcsetAttributeName !== DEFAULT_OPTIONS.srcsetAttributeName) {
        imgElem.attr(DEFAULT_OPTIONS.srcsetAttributeName, null);
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

    var setSrcAttribute = function(imgElem, srcMap, filepath) {
      switch (options.srcAttribute) {
        case 'none':
          return null;
          break;
        case 'smallest':
          var smallestImage = Object.keys(srcMap).map(function(k) {
            return [k, srcMap[k]];
          }).reduce(function(a, b) {
            return b[1] < a[1] ? b : a;
          });
          var src = path.posix.join(path.dirname(imgElem.attr('src')), smallestImage[0]);

          //base64
          if(smallestImage[1] <= 10){
            var filePath = normalizeImagePath(src, filepath);
            src = 'data:image/' + src.substr(src.lastIndexOf('.') + 1) + ';base64,' + Buffer.from(grunt.file.read(filePath.dir + '/' + filePath.base), { encoding: null }).toString('base64');
          }

          return src;
          break;
        default:
      }
    };

    var processImage = function(imgElem, filepath){
      var imgSrc = imgElem.attr('src');
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

      var srcMap = buildSrcMap(imageMatches, imagePath);

      imgElem.attr(options.srcsetAttributeName, buildSrcset(srcMap, imgElem));
      imgElem.attr('src', setSrcAttribute(imgElem, srcMap, filepath));
    }

    var parseAndExtendImg = function(filepath) {
      var content = grunt.file.read(filepath);
      var $ = cheerio.load(content, {decodeEntities: false});
      var imgElems = $('img:not(' + options.ignore.join(', ') + ')');

      //grunt.log.write(imgElems);

      imgElems.each(function() {
        var imgElem = $(this);
        var hasSrcset = imgElem.attr(options.srcsetAttributeName) !== undefined;

        if (!hasSrcset) processImage(imgElem, filepath);
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