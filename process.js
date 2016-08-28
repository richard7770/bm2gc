
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
        '$t':value,
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
        gcEntry.gContact$event = {'when': record.indmeldelsesdato.split('-').reverse().join('-'), 'label':'Indmeldt DDS'};
      if(record.medlemsnr)
        gcEntry.gContact$externalId = {'value': record.medlemsnr, 'label':'DDS', 'rel':'organization'};
      if(record.kn)
        gcEntry.gContact$gender = {'value': record.kn=='M'?'male':'female'};
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
      record.gcEntry.gContact$groupMembershipInfo.push({'href':groupid });
      createContact(record.gcEntry);
      break;
    }
  });
}

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

function createContact( gcEntry) {
  console.log('createContact', gcEntry);
  return $.ajax({
    'method':'post',
    'url':'https://content.googleapis.com/m8/feeds/contacts/default/full',
    'contentType':'application/json',
    'headers':{
      'gdata-version':'3.0',
      'authorization':'Bearer '+auth.access_token,
      },
    'data': JSON.stringify( {'entry':gcEntry})
  }).always(console.log);
}
