//  javascript: (function(){document.head.appendChild(document.createElement('script')).src = 'https://rawgit.com/richard7770/dds2contacts/master/load.js'})()
//  javascript: (function(){document.head.appendChild(document.createElement('script')).src = 'https://localhost:3541/inject.js'})()
(function() {
  var exportFields = "member_number name mobile active_function_ids/id";
  //  Fragment for main.html
  var fragmentState = {
    secret: 'g'+Math.floor(1e9*Math.random()),
    debug: true
  };
  var currentScript = $('head>script:last-child')[0];
  //  Parameters for Google authorization
  var googleOauthParam = {
    'client_id': '637601984471-e5tn9qk8mds51b069vgd7tap5fl801re.apps.googleusercontent.com',
    'scope': 'https://www.google.com/m8/feeds/',
    'response_type': 'token',
    'state': JSON.stringify(fragmentState),
    'redirect_uri': currentScript.src.replace( /[^/]+$/, 'main.html'),
  };
  //  Generate URL for Google authorization
  var authurl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    Object.keys(googleOauthParam).map(
      key => key+'='+encodeURIComponent(googleOauthParam[key])
    ).join('&');

  //  Entrypoint
  if( window.location.href.startsWith('https://medlem.dds.dk/web') ) {
    $.when( 
        fetchData(),                              //  Fetch the list of functions and members from DDS,
        openMainWindow()                          //  while starting the authorization process with google.
    ).then(                 
      function( data, port){   
        port.postMessage( JSON.stringify(data));  //  Then post the list as a message to main.html.
    });
  }
  else
    alert('Dette script kan kun bruges i DDS Medlemsservice');

  //  Returns promise of object structure
  function fetchData() {
    var fcn = new openerp.Model( 'member.function');
    var mbr = new openerp.Model( 'member.member');
    return $.when(
        fcn.query( 'id member_id organization_id function_type_id'.split(' ')).all(),
        mbr.query( 'id name member_number email mobile phone complete_address birthdate comment school school_class_number school_class_letter'
          .split(' ')).all()
        )
      .then( (f,m)=>({fcn:f, mbr:m}));
  }

  //  Returns a port promise
  function openMainWindow() {
    var dfr = $.Deferred();
    window.addEventListener('message', function listener(ev) {
      if(     ev.source === processWindow 
          &&  ev.data == fragmentState.secret 
          &&  ev.ports.length == 1) {
        window.removeEventListener('message', listener);
        dfr.resolve( ev.ports.shift());
      }
    });
    var processWindow = window.open(authurl, '_blank');
    return dfr.promise();
  }


})();
