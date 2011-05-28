var fs = require('fs'),
    file = require('file'),
    path = require('path'),
    libxmljs = require('libxmljs'),
    events = require('events'),
    util = require('util'),
    reLookupExpr = /^lookup(\.|\:)(.*?)\((.*)\)$/i,
    reMultiExpr = /^multi(\.|\:)(.*)$/i;
    
function parseTemplate(template, xmlDoc, reader) {
    var objData = {};
    
    // iterate over the keys in the template
    for (var key in template) {
        var expr = template[key],
            nodes,
            values = [],
            matches,
            multi = false,
            targetLookup;
        
        // if the expression is an object, then parse the sub-template
        if (typeof expr == 'object') {
            objData[key] = parseTemplate(expr, xmlDoc, reader);
        }
        // if it's a function then do some custom processing
        else if (typeof expr == 'function') {
            objData[key] = expr.call(reader, expr, xmlDoc);
        }
        // otherwise, run the xpath expression and convert the result
        else {
            // check if the expression is a multi expression
            matches = reMultiExpr.exec(expr);
            if (matches) {
                expr = matches[2];
                multi = true;
            } // if

            // check if the expression result should be passed through a lookup
            matches = reLookupExpr.exec(expr);
            if (matches) {
                expr = matches[3];
                targetLookup = reader.lookups[matches[2]];
            } // if
            
            // find the matching nodes
            nodes = xmlDoc.find(expr);
            
            // iterate through the nodes and get the text from the nodes
            for (var ii = 0; ii < nodes.length; ii++) {
                var name = nodes[ii].name(),
                    value = nodes[ii].text();

                if (targetLookup) {
                    value = targetLookup[value] || value;
                } // if
                
                values[values.length] = value;
            } // for
            
            objData[key] = (multi || values.length > 1) ? values : values[0];
        } // if..else
    } // for
    
    return objData;
} // parseTemplate
    
function Reader(opts) {
    var lookupsFile;
    
    this.regex = opts.regex;
    this.idExpr = opts.idExpr;
    this.type = opts.type;
    this.itemTemplate = opts.itemTemplate;
    this.lookups = {};
    this.index = 0;
    
    lookupsFile = 'lookups/' + this.type + '.json';
    if (path.existsSync(lookupsFile)) {
        this.lookups = JSON.parse(fs.readFileSync(lookupsFile));
    } // if
} // Reader

util.inherits(Reader, events.EventEmitter);

Reader.prototype.importFile = function(filename) {
    var reader = this,
        allText = '',
        stream = fs.createReadStream(filename, {
            encoding: 'utf8'
        });

    stream.on('data', function(data) {
        stream.pause();
        allText = reader.lookForItems(allText + data);
        
        stream.resume();
    });

    stream.on('end', function() {
        // look for accommodation
        reader.lookForItems(allText);
    });
};

Reader.prototype.lookForItems = function(currentData) {
    var match,
        basePath = 'data/' + (this.type ? this.type + '/' : ''),
        xmlDoc;

    do {
        match = this.regex.exec(currentData);
        if (match) {
            var idElement,
                opData = {
                    include: false
                };
                
            xmlDoc = libxmljs.parseXmlString(match[0]);
            
            if (this.idExpr) {
                idElement = xmlDoc.get(this.idExpr);
                if (idElement) {
                    opData.id = idElement.text();
                } // if
            } // if

            currentData = currentData.slice(match.index + match[0].length);
            
            this.emit('item', this.index++, xmlDoc, opData);
            
            if (opData.include && opData.id) {
                fs.writeFileSync(basePath + opData.id + '.xml', match[0]);
                
                if (this.itemTemplate) {
                    var objData = parseTemplate(this.itemTemplate, xmlDoc, this);
                    fs.writeFileSync(basePath + opData.id + '.json', JSON.stringify(objData));
                } // if
            } // if
        } // if
    } while (match);
    
    return currentData;
};

exports.run = function(opts) {
    var r = new Reader(opts);
    
    if (opts.file) {
        r.importFile(opts.file);
    } // if
    
    return r;
};