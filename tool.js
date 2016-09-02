

var auth = {
  'client_id': '339808440187-1l9an0suebhb8rkidhd6bseemc07lck9.apps.googleusercontent.com',
  'scope': 'https://www.google.com/m8/feeds/',
  'response_type': 'token',
  'state':'',
  'redirect_uri': document.currentScript.src.replace( /js$/, 'html'),
};
var authurl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
  Object.keys(auth).map(
    key => key+'='+encodeURIComponent(auth[key])
  ).join('&');

$(function(){
  if( window.location.hash)
    getToken() && console.log(auth);
  else
    window.location.href = authurl;
});
