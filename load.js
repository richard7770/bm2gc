(function() {
  //  URL for authorization page
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

  //  csv  will be a ProgressEvent
  //  port will be a ChannelPort
  var [csvReady, portReady] = mergeThreads( 'csv port',
    data => {data.port.postMessage(data.csv.target.responseText)}
  );

  //  Entrypoint
  if( window.location.href == 'https://ddsmedlem.cbrain.dk/member.aspx?func=organization.trustcodelist') {
    openProcessWindow();
    exportCsv1();
  }
  else
    alert('Dette script kan kun bruges på fanebladet "Funktioner" i Blåt Medlem.');

  function openProcessWindow() {
    window.addEventListener('message', function listener(ev) {
      if(ev.source === processWindow && ev.data == secret && ev.ports.length == 1) {
        window.removeEventListener('message', listener);
        portReady( ev.ports.shift());
      }
    });
    var processWindow = window.open(authurl, '_blank');
  }

  function exportCsv1() {
    console.log('exportCsv1');
    var form = document.forms[0];
    var action = form.getAttribute('action');
    var inputs = form.querySelectorAll('input[type=checkbox][checked],select,input[type=submit][name*=exportButton],input[type=hidden]');
    var override = {
      "T$P$M$Main$form1$filterDropDown": "onlyScouts",
      "T$P$M$Main$form1$exportChoice": "BothRelativeAndMember"
    };
    doPost( form.action, inputs, exportCsv2, override);
  }

  function exportCsv2(ev) {
    console.log('exportCsv2', ev);
    var doc = parseHtml(ev.target);
    var alink = doc.querySelector('a[onclick*="export.view"]');
    var href = alink.getAttribute('onclick').match(/'(.+?)'/)[1];
    doGet( href, exportCsv3);
  }

  function exportCsv3(ev) {
    console.log("exportCsv3", ev);
    var form = parseHtml(ev.target).forms[0];
    var action = form.getAttribute('action');
    //  Intentionally disregarding the checked-state
    var inputs = form.querySelectorAll('input[type=checkbox],input[type=submit][name*=exportButton],input[type=hidden]');
    doPost( action, inputs, csvReady, undefined, 'text/plain; charset=latin1');
  }

  //  Utility  ////////////////////////////////////////////////////////

  function mergeThreads( keys, callback) {
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

  function doGet(href, onload) {
    console.log('doGet', href);
    xhr = new XMLHttpRequest();
    xhr.open('GET', href, true);
    xhr.onload = ev => {ev.target.readyState==4 && ev.target.status==200 && onload(ev)};
    xhr.send();
  }

  function doPost( action, inputs=[], onload=null, override={}, overrideMime=null) {
    console.log('doPost', action);
    //  Merge inputs with override
    var name,dataObj = {};
    for( var e,i=0; e = inputs[i++];)
      dataObj[e.name] = e.value;
    for( name in override)
      dataObj[name] = override[name];
    //  Serialize
    var sep = '--rrpsendj01';
    var dataStr = '';
    for( name in dataObj)
      dataStr += '--' + sep
        + '\r\nContent-Disposition: form-data; name="'
        + name + '"\r\n\r\n'
        + dataObj[name] + '\r\n';
    dataStr += '--' + sep + '--\r\n';
    //  Request
    xhr = new XMLHttpRequest();
    xhr.open('POST', action, true);
    xhr.onload = ev => {ev.target.readyState==4 && ev.target.status==200 && onload(ev)};
    if(overrideMime)
      xhr.overrideMimeType( overrideMime);
    xhr.setRequestHeader('Content-type', 'multipart/form-data; boundary='+sep);
    xhr.send(dataStr);
  }

  function parseHtml(xhr)
  {
    var parser = new DOMParser();
    return parser.parseFromString(xhr.responseText, 'text/html');
  }

})();
