(function() {


  //  URL to authorization page
  var secret = 'g'+Math.floor(1e9*Math.random());
  var auth = {
    'client_id': '339808440187-1l9an0suebhb8rkidhd6bseemc07lck9.apps.googleusercontent.com',
    'scope': 'https://www.google.com/m8/feeds/',
    'response_type': 'token',
    'state':secret,
    'redirect_uri': window.bm2gc_redirect //  for debug purposes
      || document.currentScript.src.replace( /[^/]+$/, 'process.html'),
  };
  var authurl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    Object.keys(auth).map(
      key => key+'='+encodeURIComponent(auth[key])
    ).join('&');

  if( window.location.href == 'https://ddsmedlem.cbrain.dk/member.aspx?func=organization.trustcodelist')
    start();
  else
    alert('Dette script kan kun bruges på fanebladet "Funktioner" i Blåt Medlem.');

  //  csv will be a string
  //  dst will be a port for channel messaging
  var [csvReady, dstReady] = makeWait( 'csv dst', postCsv);

  function postCsv(data) {
    data.dst.postMessage(data.csv.target.responseText);
  }

  function start() {
    //  Listen for the process window
    window.addEventListener('message', function listener(ev) {
      if(ev.source === processWindow && ev.data == secret && ev.ports.length === 1) {
        window.removeEventListener('message', listener);
        dstReady( ev.ports.shift());
      }
    });
    //  Open the process window
    var processWindow = window.open(authurl, '_blank');
    //  Extract csv text
    runFromList();
  }

  function runFromList(ev)
  {
    var doc = ev && ev.constructor === ProgressEvent ? xhrToDoc(ev.target) : document;
    var form = doc.forms[0];
    var inputs = form.querySelectorAll('input[type=checkbox][checked],select,input[type=submit][name*=exportButton],input[type=hidden]');
    var override = {
      "T$P$M$Main$form1$filterDropDown": "onlyScouts",
      "T$P$M$Main$form1$exportChoice": "BothRelativeAndMember"
    };
    var action = form.getAttribute('action');

    doPost( null, action, inputs, loadPopup, override);
  }


  function loadPopup(ev)
  {
    //  'this' is the xhr of clicking the Export button
    //  it contains a link toward the popup
    var doc = ev && ev.constructor === ProgressEvent ? xhrToDoc(ev.target) : document;
    var alink = doc.querySelector('a[onclick*="export.view"]');
    var href = alink.getAttribute('onclick').match(/'(.+?)'/)[1];
    doGet( this, href, runFromPopup);
  }


  //  Respond to click in popup
  function runFromPopup(ev){
    console.log(["runFromPopup", ev, this]);
    var doc = ev && ev.constructor === ProgressEvent ? xhrToDoc(ev.target) : document;
    var form = doc.forms[0];
    //  Intentionally disregarding the checked-state
    var inputs = form.querySelectorAll('input[type=checkbox],input[type=submit][name*=exportButton],input[type=hidden]');
    var action = form.getAttribute('action');
    doPost( null, action, inputs, csvReady, undefined, 'text/plain; charset=latin1');
  }

  //  Utility  ////////////////////////////////////////////////////////

  function makeWait(keys, callback) {
    if( typeof(keys)=='string')  keys = keys.match(/\S+/g);
    var data = {};
    var count = keys.length;
    return keys.map( (key)=>{
      return (value)=>{
        if( data.hasOwnProperty(key)) return;
        console.log('Waited for ', key, value);
        data[key]=value;
        if(--count==0) callback(data);
      };
    });
  }

  function build( code, parent, nextSibling, ...args) {
    var buildreelm = /(\(|\))|(".+?"|\w+|\?)([^() ]+)?/g;
    var buildreprop = /([.:#])([.?\w]+)(?:=([^,]+))?/g;
    function qmark( str) {
      if (str=="?")
      return args.shift();
      else
      return str;
    }
    if(typeof(parent)=='string')
    parent = document.querySelector(parent);
    if(typeof(nextSibling)=='string')
    nextSibling = document.querySelector(nextSibling);
    var newNodes = [];
    var m, elm;
    while( m = buildreelm.exec(code))
    switch (m[1]) {
      case '(':
      parent = elm;
      break;
      case ')':
      parent = parent.parentNode;
      break;
      default:
      var mm;
      //  Create Text
      if( mm = m[2].match(/^"(.+)"$/))
      elm = document.createTextNode( qmark(mm[1]) );
      //  Create Element
      else {
        elm = document.createElement( qmark(m[2]));
        //  Set properties
        while( mm = buildreprop.exec(m[3]))
        {
          var [all,type,key,value] = mm;
          var keyparts = key.split('.');
          switch (type) {
            case '.':   //  Class
            elm.className = keyparts.map(qmark).join(' ');
            break;
            case '#':   //  Id
            elm.id = qmark(key);
            break;
            case ':':   //  JS Property (deep)
            var owner = elm;
            while( keyparts.length > 1)
            owner = owner[qmark(keyparts.shift())];
            owner[qmark(keyparts.shift())] = qmark( value);  // Yes, lhs destination _is_ evaluated first
          }
        }
      }
      newNodes.push(elm);
      if(parent)
      parent.appendChild(elm);
      else if(nextSibling)
      nextSibling.parentNode.insertBefore(elm, nextSibling);
    }
    return newNodes;
  }

  function doGet(xhr, href, onload) {
    console.log('Getting: '+href);
    // debugger;
    xhr = xhr || new XMLHttpRequest();
    xhr.onload = onload;
    // xhr.onreadystatechange = getXhrWatch();
    xhr.open('GET', href, true);
    xhr.send();
    return xhr;
  }

  function doPost( xhr, action, inputs=[], onload=null, override={}, overrideMime=null) {
    var name,merge = {};
    for( var e,i=0; e = inputs[i++];)
    merge[e.name] = e.value;
    for( name in override)
    merge[name] = override[name];

    var sep = '--rrpsendj01';
    var data = '';
    for( name in merge)
    data += '--' + sep + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + merge[name] + '\r\n';
    data += '--' + sep + '--\r\n';

    console.log('Posting: '+action);
    // debugger;
    xhr = xhr || new XMLHttpRequest();
    xhr.onload = onload;
    // xhr.onreadystatechange = getXhrWatch();
    xhr.open('POST', action, true);
    if(overrideMime)
    xhr.overrideMimeType( overrideMime);
    xhr.setRequestHeader('Content-type', 'multipart/form-data; boundary='+sep);
    xhr.send(data);
    return xhr;
  }

  function xhrToDoc(xhr)
  {
    return (new DOMParser()).parseFromString(xhr.responseText, 'text/html');
  }


})();
