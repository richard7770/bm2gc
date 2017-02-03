
$(function(){
  parseFragment();
  var contacts,csv;
  if( fragment.debug == 'local') {
    csv = $.get('members.csv').then( d=>d);
    contacts = $.get('contacts.json');
  }
  else {
    var token = verifyToken();
    csv = token.then(getCsvThroughChannel);
    contacts = token.then(getAllContacts);
    if( fragment.state && fragment.state.debug) {
      csv.done( d=>{makeDownloadLink(d, 'members.csv')} );
      contacts.done( (o,s,xhr)=>{makeDownloadLink(xhr.responseText, 'contacts.json')} );
    }
  }
  csv.done( parseCsv);
  contacts.done( console.log);

});

function parseCsv( csv) {
  var reHead = /.+/g;
  var reField = /"((?:""|[^"])*)"/g;

  //  Get headers
  var template = {};
  var headers = reHead.exec(csv)[0]
    .toLowerCase()
    .match( reField)
    .map( unquote)
    .map( field => { 
        var name = field.replace( 
            /[^a-z0-9]+(.?)/g, 
            (all,letter)=>letter.toUpperCase());
        template[name] = field.match('/') && [] || undefined;
        return name;
      });
  console.log( template);
  template = JSON.stringify( template);

  //  Get all field values (onedimensionally)
  var allFields = csv
    .substr( reHead.lastIndex)
    .match( reField)
    .map( unquote);
  console.log( allFields);

  //  Create member- and function dictionaries
  var n=-1, members={}, current, functions={};
  for( var f of allFields) {
    n++; n %= headers.length;
    if( !f) continue;
    var header = headers[n];
    if( n==0)
      current = JSON.parse( template);
    if( header == 'memberNumber')
      members[f] = current;
    if( header == 'activeFunctionIdsId') {
      f = f.replace( /func-(\d+)-(\d+)-(\d+(?:-\d+)?)-(\d+)/, '$1-$3');
      if( !functions[f]) functions[f] = [];
      functions[f].push( current);
    }
    if( current[header] && current[header].push)
      current[header].push(f);
    else 
      current[header] = f;
  }
  console.log(members,functions);

  function unquote( f) {
    return f
      .substr( 1, f.length-2) //  Drop surrounding quotes
      .replace( /""/g, '"');  //  Unescape quotes
  }

}


function makeDownloadLink( data, filename, type='text/plain') {
  var blob = new Blob( [data], {'type':type});
  var url  = URL.createObjectURL( blob);
  $('<a>')
    .attr('href',url)
    .attr('download', filename)
    .css('display','block')
    .append('Download ' + filename)
    .prependTo(document.body);
}
function getCsvThroughChannel() {
  //  Establish channel
  var channel = new MessageChannel();
  var dfr = $.Deferred();
  channel.port1.onmessage = function(ev){
    dfr.resolve(ev.data);
  };
  window.opener.postMessage(
    fragment.state.secret, '*', 
    [channel.port2]); // TODO: domain
  return dfr;
}

function getAllContacts() {
  //  Debug
  if( fragment.debug == 'local')
    return $.get('contacts.json');
  else
    return ajaxM8({'max-results':9000});
}



//
//  Parse the URL fragment into 'fragment'
//  Returns true on success
//
var fragment = {};
function parseFragment() {
  var m, re=/(\w+)=([^&]*)/g;
  while( m = re.exec(window.location.hash))
    fragment[m[1]] = decodeURIComponent(m[2]);
  if(fragment.state)
    fragment.state = JSON.parse( fragment.state);
}

//  
//  Verify that the token refers to the intended google project
//  
var client_id = '637601984471-e5tn9qk8mds51b069vgd7tap5fl801re.apps.googleusercontent.com';
var verifyUrl = 'https://www.googleapis.com/oauth2/v3/tokeninfo';
function verifyToken() {
  if( fragment.debug == 'local') 
    return $.Deferred().resolve();
  else if (!fragment.access_token) 
    return $.Deferred().reject('Unable to find access_token in fragment.');
  return $.ajax({
    'url': verifyUrl,
    'dataType': 'json',
    'data': {'access_token': fragment.access_token}
  }).then( (data,status,xhr) => {
    if (data.aud !== client_id)
      return $.Deferred().reject('Verification failed: Wrong audience');
  });
}

//
//  Request an authorized /m8 feed
//    data:       plain object
//    method:     get, post, put or delete
//    feed:       contacts or groups
//    projection: full or full/batch
//    type:       json or xml
//  Returns promise
//
function ajaxM8(data, method='get', feed='contacts',
  projection='full', type='json') {
  if( type == 'xml' ){
    type = 'application/atom+xml';
    if( data.constructor == XMLDocument)
      data = new XMLSerializer().serializeToString(data);
    else if(typeof(data) == 'object')
      data = toXml(data, true);
  }
  else if (type == 'json') {
    type = 'application/json';
    projection += '?alt=json';
    if(typeof(data) == 'object' && !method.match(/^get$/i))
      data = JSON.stringify( data);
  }

  return $.ajax({
    'method':method,
    'url':'https://content.googleapis.com/m8/feeds/' +
      feed + '/default/' + projection,
    'contentType':type,
    'headers':{
      'gdata-version':'3.0',
      'authorization':'Bearer '+fragment.access_token,
      },
    'data': data
  }).always(console.log).done(d=>{window.data=d});
}


//  Everything in use is above this line
/////////////////////////////////////////
//
//
//
//
var rel = {
  'home': 'http://schemas.google.com/g/2005#home',
  'work': 'http://schemas.google.com/g/2005#work',
  'other': 'http://schemas.google.com/g/2005#other',
  'mobile': 'http://schemas.google.com/g/2005#mobile',
};

var rawPhone = {
  'home': 'kontaktPrivatTlf',
  'mobile': 'kontaktMobilTlf',
  'work': 'kontaktArbejdeTlf',
};

var rawEmail = {
  'home': 'kontaktPrimrEmail',
  'other': 'kontaktEkstraEmailAdresser',
};


//
//  Embed an array into a feed of entries
//    input:      array of
//    operation:  insert, query, update or delete
//    template:   optional, e.g. {'id':{'$t':0}}
//      If template is given then it is cloned into the output array
//      for each input item. The input item is replacing 0.
//
//  Returns plain object as toplevel container with 'feed' property
//
function batchify( input, operation, template=null){
  var i, o, n = 0, output=[];
  for (i of input) {
    e = template ? clone(template,[i]) : i;
    e.batch$operation = {'type': operation};
    e.batch$id = {'$t': n++};
    output.push(e);
  }
  return {'feed':{'entry': output}};
}

//
//  Create a deep clone of input, depending on .constructor:
//    Array:  clone each item recusively
//    Object: clone each item recusively
//    Number: replace with sub[input]
//    else:   reuse input
//
function clone( input, sub=[]) {
  if( input.constructor === Array)
    return input.map( e=>clone(e,sub) );
  else if( input.constructor === Object) {
    var key, newObj = {};
    for( key in input)
      newObj[key] = clone(input[key],sub);
    return clone;
  }
  else if( input.constructor === Number)
    return sub[input];
  else return input;
}

//
//  Create XML document or string [if serialize=true]
//    obj:            Top level container
//    serialize:      Return string via XMLSerializer
//    parentElement:  null; only for internal recursion
//
function toXml(obj, serialize=false, parentElement) {
  if (parentElement) {  // Recursion
    var doc = parentElement.ownerDocument;
    for (var key in obj) {
      var value = obj[key];
      var xmlKey = key.replace('$',':');
      //  Text node
      if(key=='$t')
        parentElement.appendChild(doc.createTextNode(value));
      //  Attribute
      else if(typeof(value)=='string' || typeof(value)=='number')
        parentElement.setAttribute(xmlKey,value);
      //  Multiple elements
      else if(value.constructor===Array)
        for (var subval of value)  //  subval must be object
          toXml( subval, serialize, parentElement.appendChild(
            doc.createElement(xmlKey)));
      //  Single element
      else toXml( value, serialize, parentElement.appendChild(
            doc.createElement(xmlKey)));
    }
  }
  else {  //  Entrypoint
    var rootElement = Object.keys(obj).shift();
    var doc = new DOMParser().parseFromString( '<'+rootElement+'/>', 'application/xml');
    toXml( obj[rootElement], serialize, doc.documentElement);
    if(serialize) return '<?xml version="1.0" encoding="UTF-8"?>' +
      new XMLSerializer().serializeToString(doc);
    else return doc;
  }
}


function createGroup(groupName) {
  if(!groupName)  groupName = 'G'+Date.now();
  console.log('createGroup', groupName);
  return  ajaxM8( {'entry':{'title':{'$t':groupName}}},
    'post', 'groups', 'full', 'json' );
}

function createContacts( data) {
  console.log('createContacts', data);
  data = batchify( data, 'insert');
  return ajaxM8( data, 'post', 'contacts', 'full/batch', 'xml');
}


function getGroups(data={}) {
  return ajaxM8(data, 'get', 'groups' );
}

function getContacts(q,group) {
  var data = {};
  if(q) data.q = q;
  if(group) data.group = group;
  return ajaxM8( data, 'get', 'contacts' );
}






var rel = {
  'home': 'http://schemas.google.com/g/2005#home',
  'work': 'http://schemas.google.com/g/2005#work',
  'other': 'http://schemas.google.com/g/2005#other',
  'mobile': 'http://schemas.google.com/g/2005#mobile',
};

var rawPhone = {
  'home': 'kontaktPrivatTlf',
  'mobile': 'kontaktMobilTlf',
  'work': 'kontaktArbejdeTlf',
};

var rawEmail = {
  'home': 'kontaktPrimrEmail',
  'other': 'kontaktEkstraEmailAdresser',
};

//  Create group objects
function handleCsv(csv) {
  console.log('handleCsv');
  var record, records=[], primary=[], secondary=[];
  parseCsv( csv, (record)=>{
    records.push(record);
    var gcEntry = record.gcEntry = {
      'gd$name': {'gd$fullName':{'$t':record.kontaktNavn}},
      'gd$phoneNumber': [],
      'gd$email': [],
      'gd$structuredPostalAddress': [],
      'gContact$groupMembershipInfo': [],
    };
    //  Add address
    gcEntry.gd$structuredPostalAddress.push({
      'rel': rel.home,
      'gd$formattedAddress':{'$t':
        record.kontaktAdresse+'\n'+record.kontaktPostnrby+'\n'+record.kontaktLandenavn }
    });
    for (var r in rel){
      //  Add phone
      var value = record[rawPhone[r]];
      if( value)  gcEntry.gd$phoneNumber.push({
        'rel':rel[r],
        '$t':value,
        'primary': r=='mobile'
      });
      //  Add email
      value = record[rawEmail[r]];
      if( value) gcEntry.gd$email.push({
        'rel':rel[r],
        'address':value,
        'primary': r=='home'
      });
    }
    //  Identify primary records
    if( record.medlemsnavn == record.kontaktNavn) {
      primary.push(record);
      record.isPrimary = true;
      //  Add primary-only fields
      if(record.fdselsdato)
        gcEntry.gContact$birthday = {'when': record.fdselsdato.split('-').reverse().join('-')};
      if(record.indmeldelsesdato)
        gcEntry.gContact$event = [{
          'gd$when': {'startTime':record.indmeldelsesdato.split('-').reverse().join('-')},
          'label': 'IndmeldtDDS'}];
      if(record.medlemsnr)
        gcEntry.gContact$externalId = [{
          'value': record.medlemsnr,
          'label':'Medlemsnr DDS'}];
      if(record.kn)
        gcEntry.gContact$gender = {'value': record.kn=='M'?'male':'female'};
    }
  });

  //  Identify secondary records
  for(record of records) if( !record.isPrimary )
    secondary.push(record);
  createAndFillGroup( primaryName, primary);
  createAndFillGroup( secondaryName, secondary);
}

function parseCsv1( csv, recordCallback) {
  console.log('parseCsv');
  var reField = /([\r\n]*)"(([^"]|"")*)",/g;
  var m, line;
  var lines = [line=[]];

  //  Break the CSV into lines and fields
  while( m = reField.exec(csv)) {
    if(m[1]) lines.push(line=[]);
    line.push(m[2]
      .replace(/""/g,'"')           //  Unescape ""
      .replace(/[ \t]+/g,' ')       //  Collapse space
      .replace(/^\s+|\s+$/g,''));   //  Trim
  }

  //  CameCase field names
  var reBadChar = /[^a-z0-9 ]/g;
  var reInitial = / +(.)/g;
  var headers = lines.shift().map( (t)=>{
    return t.toLowerCase()
    .replace( reBadChar, '')
    .replace( reInitial, (m)=>{return m[1].toUpperCase();});
  });

  //  Make record objects
  for(line of lines) {
    //  Name fields
    var header, record = {};
    for(header of headers)
    record[header] = line.shift();
    recordCallback(record);
  }
}

function createAndFillGroup( groupName, contacts) {
  console.log('createAndFillGroup', arguments);
  createGroup(groupName).then((data,status,xhr)=>{
    var groupid = data.entry.id.$t;
    var updatedContacts=[], newContacts=[];
    for (record of contacts) {
      record.gcEntry.gContact$groupMembershipInfo.push({'href':groupid });
      // if(record.gcEntry.id)
      //   updatedContacts.push(record.gcEntry)
      // else
      newContacts.push(record.gcEntry)
    }
    // if(updatedContacts.length)
    //   updateContact(updatedContacts);
    // if(newContacts.length)
    createContacts(newContacts);
  });
}
