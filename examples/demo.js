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

slicer.on('item', function(index, xmlDoc, itemData) {
});

slicer.on('parsed', function(index, xmlDoc, itemData) {
});

slicer.on('parseError', function(message) {
    console.log(message);
});