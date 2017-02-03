//  javascript: (function(){document.head.appendChild(document.createElement('script')).src = 'https://rawgit.com/richard7770/bm2gc/master/load.js'})()
//  javascript: (function(){document.head.appendChild(document.createElement('script')).src = 'https://localhost:3541/inject.js'})()
(function() {
  var exportFields = "member_number name mobile active_function_ids/id";
  //  Fragment for main.html
  var mainFragment = {
    secret: 'g'+Math.floor(1e9*Math.random()),
    debug:  'local',
  };
  var currentScript = $('head>script:last-child')[0];
  //  Parameters for Google authorization
  var auth = {
    'client_id': '637601984471-e5tn9qk8mds51b069vgd7tap5fl801re.apps.googleusercontent.com',
    'scope': 'https://www.google.com/m8/feeds/',
    'response_type': 'token',
    'state': JSON.stringify(mainFragment),
    'redirect_uri': currentScript.src.replace( /[^/]+$/, 'main.html'),
  };
  //  URL for Google authorization
  var authurl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    Object.keys(auth).map(
      key => key+'='+encodeURIComponent(auth[key])
    ).join('&');

  //  Entrypoint
  if( window.location.href.startsWith('https://medlem.dds.dk/web') ) {
    $.when( 
        fetchCsv(),         //  Fetch the list of members from DDS,
        openMainWindow()    //  while starting the authorization process with google.
    ).then( function(xhr,port){   //  Then post the list as a message to main.html.
      port.postMessage(xhr[0]);
    });
  }
  else
    alert('Dette script kan kun bruges på fanebladet "Medlemmer" i DDS Medlemsservice');

  //  Returns an ajax promise
  function fetchCsv() {
    var data = {
      "model":"member.profile",
      "fields": exportFields.split(' ')
        .map( function(f){
          var [n,l] = f.split(':');
          return {name: n, label: l||f};
        }),
      "ids":false,
      "domain":[["state","=","active"]],
      "import_compat":true};
    return $.post('/web/export/csv', {
      data: JSON.stringify( data),
      token: Date.now() });
  }

  //  Returns a port promise
  function openMainWindow() {
    var dfr = $.Deferred();
    window.addEventListener('message', function listener(ev) {
      if(     ev.source === processWindow 
          &&  ev.data == mainFragment.secret 
          &&  ev.ports.length == 1) {
        window.removeEventListener('message', listener);
        dfr.resolve( ev.ports.shift());
      }
    });
    var processWindow = window.open(authurl, '_blank');
    return dfr.promise();
  }


})();
