# xmlslicer

This is utility designed for use with [NodeJS][http://nodejs.org/] scripts to assist with liberating data from XML feeds and files and converting them into useful JSON snippets.

Using [libxmljs](https://github.com/polotek/libxmljs) as the core XML processing tool, xmlslicer is designed to help you extract the pieces of useful data from XML and leaving the rest.  It is designed to be used by people with a good handle on [XPath](http://www.w3.org/TR/xpath/) as that is the core technique used to extract the _useful bits_ from the XML.

## Installing

For the moment, you are probably best cloning this repository into the `node_modules` directory of a project that you want to use it in.  I'll eventually get around to adding it to npm, promise...

## Example Use

```js
var xmlslicer = require('xmlslicer'),
    slicer;
    
slicer = xmlslicer.run({
    type: 'typeName',
    file: 'where/your/xml/lives.xml',
    regex: /\<Item(.|\n|\r)*?\<\/Item\>/i,
    idExpr: '@ItemID',

    template: {
        id: '@ItemID',
        name: 'req://Item/@Name',
        description: '//Item/Description',

        // initialise the position
        pos: {
            lat: 'float://Item/@Latitude',
            lon: 'float://Item/@Longitude'
        }
    }
});

slicer.on('item', function(index, xmlDoc, opData) {
});

slicer.on('parsed', function(index, xmlDoc, opData) {
});

slicer.on('parseError', function(message) {
    console.log(message);
});
```

## Custom Expressions and Lookups

To be completed

## Custom Extraction Functions

To be completed