
//  Group names to create
var primaryName = 'Spejdere';
var secondaryName = 'Forældre';


$(function(){
  getToken()              //  Resolves empty
  .then(verifyToken)      //  Resolves as ajax
  .then(establishChannel) //  Resolves with csv
  .then(handleCsv)        //  Pass through
});

//  Parse URL fragment
var auth = {};
function getToken() {
  var m, re=/(\w+)=([^&]*)/g;
  var dfd = $.Deferred();
  while( m = re.exec(window.location.hash))
    auth[m[1]] = decodeURIComponent(m[2]);
  if (auth.access_token) dfd.resolve()
  else dfd.reject()
  return dfd;
}

var client_id = '339808440187-1l9an0suebhb8rkidhd6bseemc07lck9.apps.googleusercontent.com';
var verifyUrl = 'https://www.googleapis.com/oauth2/v3/tokeninfo';
function verifyToken() {
  return $.ajax({
    'url': verifyUrl,
    'dataType': 'json',
    'data': {'access_token': auth.access_token}
  }).then( (data,status,xhr) => {
    if (data.aud !== client_id)
      return $.Deferred().reject('Verification failed: Wrong audience');
  });
}

function establishChannel() {
  console.log('establishChannel',arguments);
  var channel = new MessageChannel();
  var dfd = $.Deferred();
  channel.port1.onmessage = function(ev){
    dfd.resolve(ev.data);
  };
  window.opener.postMessage(auth.state,'*',[channel.port2]); // TODO: domain
  return dfd;
}

//  Create group objects
function handleCsv(csv) {
  console.log('handleCsv');

  var record, records=[], primary=[], secondary=[];
  parseCsv( csv, (raw)=>{
    //  Set common fields
    records.push(record={});
    record.name        = raw.kontaktNavn;
    record.mobilePhone = raw.kontaktMobilTlf;
    record.homePhone   = raw.kontaktPrivatTlf;
    record.workPhone   = raw.kontaktArbejdeTlf;
    record.homeEmail   = raw.kontaktPrimrEmail;
    record.otherEmail  = raw.kontaktEkstraEmailAdresser;
    record.homeAddress = raw.kontaktAdresse+'\n'+raw.kontaktPostnrby+'\n'+raw.kontaktLandenavn

    //  Identify primary records
    if( raw.medlemsnavn == raw.kontaktNavn) {
      primary.push(record);
      record.isPrimary = true;
      //  Set primary-only fields
      record.birthday = raw.fdselsdato      .split('-').reverse().join('-');
      record.joinDds  = raw.indmeldelsesdato.split('-').reverse().join('-');
    }
  });

  //  Identify secondary records
  for(record of records) if( !record.isPrimary )
    secondary.push(record);
  createAndFillGroup( primaryName, primary);
  // createAndFillGroup( secondaryName, secondary);
}

function parseCsv( csv, recordCallback) {
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
    var record, groupid = data.entry.id.$t;
    for (record of contacts) {
      createContact(record, [groupid]);
      break;
    }
  });
}

var rel = {
  'home': 'http://schemas.google.com/g/2005#home',
  'work': 'http://schemas.google.com/g/2005#work',
  'other': 'http://schemas.google.com/g/2005#other',
  'mobile': 'http://schemas.google.com/g/2005#mobile',
};

function createGroup(groupName) {
  if(!groupName)  groupName = 'G'+Date.now();
  console.log('createGroup', groupName);
  return $.ajax({
    'method':'post',
    'url':'https://content.googleapis.com/m8/feeds/groups/default/full',
    'contentType':'application/json',
    'headers':{
      'gdata-version':'3.0',
      'authorization':'Bearer '+auth.access_token,
      },
    'data': JSON.stringify( {'entry':{'title':{'$t':groupName}}})
  }).always(console.log);
}

function createContact( data,groups=[]) {
  console.log('createContact', data);
  //  Name is mandatory
  //  and empty containers will collapse.
  var entry = {
    'gd$name': {'gd$fullName':{'$t':data.name}},
    'gd$phoneNumber': [],
    'gd$email': [],
    'gd$structuredPostalAddress': [],
    'gContact$groupMembershipInfo': [],
  };
  //  Add phone, mail and addresses
  for (var r in rel){
    //  Add phone
    var value = data[r+'Phone'];
    if( value)
      entry.gd$phoneNumber.push({
        'rel':r,
        '$t':value,
        'primary': r=='mobile'
      });
    //  Add email
    value = data[r+'Email'];
    if( value)
      entry.gd$email.push({
        'rel':r,
        '$t':value,
        'primary': r=='home'
      });
    //  Add address
    value = data[r+'Address'];
    if( value)
      entry.gd$structuredPostalAddress.push({
        'rel':r,
        'gd$formattedAddress':{'$t':value}
      });
  }
  //  Add groups
  for (var group of groups)
    entry.gContact$groupMembershipInfo.push({
      'href':group });

  //  Make request
  return $.ajax({
    'method':'post',
    'url':'https://content.googleapis.com/m8/feeds/contacts/default/full',
    'contentType':'application/json',
    'headers':{
      'gdata-version':'3.0',
      'authorization':'Bearer '+auth.access_token,
      },
    'data': JSON.stringify( {'entry':entry})
  }).always(console.log);
}
