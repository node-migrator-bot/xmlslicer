var fs = require('fs'),
    file = require('file'),
    path = require('path'),
    libxmljs = require('libxmljs'),
    events = require('events'),
    util = require('util'),
    reFlaggedExpr = /^(.*?)(\.|\:)(.*)$/,
    reLookupExpr = /^(.*?)\((.*)\)$/;
    
    // define the default flag handlers
    DEFAULT_FLAG_HANDLERS = {
        multi: function(flags) {
            flags.multi = true;
        },
        
        'float': function(flags) {
            flags.converter = parseFloat;
        },
        
        'int': function(flags) {
            flags.converter = parseInt;
        },
        
        'boolean': function(flags) {
            flags.converter = function(value) {
                return value ? true : false;
            };
        },
        
        lookup: function(flags, expr) {
            // find the lookup function
            var matches = reLookupExpr.exec(expr);
            if (matches) {
                flags.lookupName = matches[1];
                expr = matches[2];
            } // if
            
            return expr;
        },
        
        required: function(flags) {
            flags.required = true;
        }
    };
    
function parseTemplate(template, slicer, opData) {
    var objData = {};
    
    function templateError(message) {
        slicer.emit(
            'templateError', 
            message,
            this,
            opData
        );
    } // templateError
    
    // iterate over the keys in the template
    for (var key in template) {
        var expr = template[key],
            nodes,
            values = [],
            flags = {},
            matches,
            targetLookup = null;
        
        // if the expression is an object, then parse the sub-template
        if (typeof expr == 'object') {
            objData[key] = parseTemplate.call(this, expr, slicer, opData);
        }
        // if it's a function then do some custom processing
        else if (typeof expr == 'function') {
            objData[key] = expr.call(this, expr, slicer);
        }
        // otherwise, run the xpath expression and convert the result
        else {
            // while we are finding flags in the expression remove them
            do {
                matches = reFlaggedExpr.exec(expr);
                if (matches) {
                    var handler = slicer.flagHandlers[matches[1]];
                    
                    // remove the flag from the expression
                    expr = matches[3];

                    // if we have a handler, then execute it
                    if (handler) {
                        expr = handler(flags, expr) || expr;
                    }
                    else {
                        templateError('Found expression flag (' + matches[1] + ') but no handler is defined');
                    } // if..else
                } // if
            } while (matches);
            
            if (flags.lookupName) {
                targetLookup = slicer.lookups[flags.lookupName];
            } // if
            
            // find the matching nodes
            nodes = this.find(expr);
            
            // iterate through the nodes and get the text from the nodes
            for (var ii = 0; ii < nodes.length; ii++) {
                var name = nodes[ii].name(),
                    value = nodes[ii].text().trim(); // TODO: check whether we should trim

                if (targetLookup) {
                    // if the target lookup doesn't have a value, then report an error
                    if (! targetLookup[value]) {
                        templateError('Unable to find value (' + value + ') in lookup: ' + flags.lookupName);
                    } // if
                    
                    value = targetLookup[value] || value;
                } // if
                
                values[values.length] = flags.converter ? flags.converter(value) : value;
            } // for
            
            // if required and we have no values, then report an error
            if (flags.required && values.length == 0) {
                templateError('Value of expression (' + expr + ') returned no matches and was required');
            } // uf
            
            objData[key] = (flags.multi || values.length > 1) ? values : values[0];
        } // if..else
    } // for
    
    return objData;
} // parseTemplate
    
function XMLSlicer(opts) {
    var lookupsFile, key;
    
    this.regex = opts.regex;
    this.idExpr = opts.idExpr;
    this.type = opts.type;
    this.template = opts.template;
    this.lookups = {};
    this.index = 0;
    
    // initialise the flag handlers
    this.flagHandlers = {};
    for (key in DEFAULT_FLAG_HANDLERS) {
        this.flagHandlers[key] = DEFAULT_FLAG_HANDLERS[key];
    } // for
    
    // add any flag handlers specified in the options
    for (key in opts.flagHandlers) {
        this.flagHandlers[key] = opts.flagHandlers[key];
    } // for
    
    lookupsFile = 'lookups/' + this.type + '.json';
    if (path.existsSync(lookupsFile)) {
        this.lookups = JSON.parse(fs.readFileSync(lookupsFile));
    } // if
} // XMLSlicker

util.inherits(XMLSlicer, events.EventEmitter);

XMLSlicer.prototype.importFile = function(filename) {
    var slicer = this,
        allText = '',
        stream = fs.createReadStream(filename, {
            encoding: 'utf8'
        });

    stream.on('data', function(data) {
        stream.pause();
        allText = slicer.lookForItems(allText + data);
        
        stream.resume();
    });

    stream.on('end', function() {
        // look for accommodation
        slicer.lookForItems(allText);
    });
};

XMLSlicer.prototype.lookForItems = function(currentData) {
    var match,
        basePath = 'data/' + (this.type ? this.type + '/' : ''),
        xmlDoc;

    do {
        match = this.regex.exec(currentData);
        if (match) {
            var idElement,
                opData = {
                    include: false,
                    saveXML: false,
                    saveJSON: true
                };
                
            xmlDoc = libxmljs.parseXmlString(match[0]);
            
            if (this.idExpr) {
                idElement = xmlDoc.get(this.idExpr);
                if (idElement) {
                    opData.id = idElement.text();
                } // if
            } // if

            currentData = currentData.slice(match.index + match[0].length);

            // trigger the item event
            this.emit('item', this.index, xmlDoc, opData);
            
            // if the opdata says we should include it and we have an id
            // then do so
            if (opData.include && opData.id) {
                if (this.template) {
                    var objData = parseTemplate.call(xmlDoc, this.template, this, opData);
                    
                    // trigger the parsed event
                    this.emit('parsed', this.index, objData, opData);

                    // if the opdata specifies saving the json, then do that now
                    if (opData.saveJSON) {
                        fs.writeFileSync(
                            basePath + opData.id + '.json', 
                            JSON.stringify(objData)
                        );
                    } // if
                } // if

                // if the op data would like us to save the xml, then do that
                if (opData.saveXML) {
                    fs.writeFileSync(
                        basePath + opData.id + '.xml',
                        match[0]
                    );
                }
            } // if
            
            // increment the item index
            this.index++;
        } // if
    } while (match);
    
    return currentData;
};

exports.run = function(opts) {
    var slicer = new XMLSlicer(opts);
    
    if (opts.file) {
        slicer.importFile(opts.file);
    } // if
    
    return slicer;
};