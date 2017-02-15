
$(function(){
  parseFragment();
  var contacts, members;
  if( fragment.debug == 'local') {
    //  Fetch locally
    members = $.get('members.json').then( d=>d);
    contacts = $.get('contacts.json').then( d=>d);
  }
  else {
    //  Fetch from server
    members = $.when().then( getMembersByChannel);
    contacts = verifyToken().then( getContactsByXhr);
    if( fragment.state && fragment.state.debug) {
      //  Make download links
      members.done( d=>{makeDownloadLink(d, 'members.json')} );
      contacts.done( d=>{makeDownloadLink(d, 'contacts.json')} );
    }
  }
  members.done( console.log);
  contacts.done( console.log);

});



function makeDownloadLink( data, filename, type='text/plain') 
{
  var blob = new Blob( [JSON.stringify(data)], {'type':type});
  var url  = URL.createObjectURL( blob);
  $('<a>')
    .attr('href',url)
    .attr('download', filename)
    .css('display','block')
    .css('margin','1ex')
    .append('Download ' + filename)
    .prependTo(document.body);
}

function getMembersByChannel() 
{
  //  Establish channel
  var channel = new MessageChannel();
  var dfr = $.Deferred();
  channel.port1.onmessage = function(ev){
    dfr.resolve( JSON.parse(ev.data));
    channel.port1.close();
  };
  window.opener.postMessage(
    fragment.state.secret, '*', 
    [channel.port2]); // TODO: domain
  return dfr;
}

function  getContactsByXhr() 
{
  return ajaxM8({'max-results':9000}).then( d=>d);
}



//
//  Parse the URL fragment into 'fragment'
//  Returns true on success
//
var fragment = {};
function parseFragment() 
{
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
function verifyToken() 
{
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
//  Examples:
//ajaxM8( {}, 'get', 'groups' );
//ajaxM8( {q:'jens', group:'junior'}, 'get', 'contacts' );
//
function ajaxM8(data, method='get', feed='contacts',
  projection='full', type='json') 
{
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
//  Embed an array into a feed of entries
//    input:      array of
//    operation:  insert, query, update or delete
//    template:   optional, e.g. {'id':{'$t':0}}
//      If template is given then it is cloned into the output array
//      for each input item. The input item is replacing 0.
//
//  Returns plain object as toplevel container with 'feed' property
//
function batchify( input, operation, template=null)
{
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
function clone( input, sub=[]) 
{
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
function toXml(obj, serialize=false, parentElement) 
{
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


function createGroup(groupName) 
{
  if(!groupName)  groupName = 'G'+Date.now();
  console.log('createGroup', groupName);
  return  ajaxM8( {'entry':{'title':{'$t':groupName}}},
    'post', 'groups', 'full', 'json' );
}

function createContacts( data) 
{
  console.log('createContacts', data);
  data = batchify( data, 'insert');
  return ajaxM8( data, 'post', 'contacts', 'full/batch', 'xml');
}








var rel = {
  'home': 'http://schemas.google.com/g/2005#home',
  'work': 'http://schemas.google.com/g/2005#work',
  'other': 'http://schemas.google.com/g/2005#other',
  'mobile': 'http://schemas.google.com/g/2005#mobile',
};

