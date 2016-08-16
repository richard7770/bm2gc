(function(){

//  Check location 
if(!window.location.href.startsWith("https://ddsmedlem.cbrain.dk/"))
  return console.log("Location not recognized.");
  
//  Inject links
if(window.location.href == "https://ddsmedlem.cbrain.dk/simple.aspx?func=export.view&helpkey=organization.trustcodelist")
  build( 'a:onclick=?("Export to Contacts")', null, 'input[type=submit]', runFromPopup);
if(window.location.href == "https://ddsmedlem.cbrain.dk/member.aspx?func=organization.trustcodelist")
  build( 'a:onclick=?("Export to Contacts")', 'div.buttons-bottom', null, runFromList);


function runFromList(ev)
{
  var doc = ev.__proto__ === ProgressEvent.prototype ? xhrToDoc(ev.target) : document;
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
  var doc = ev.__proto__ === ProgressEvent.prototype ? xhrToDoc(ev.target) : document;
  var alink = doc.querySelector('a[onclick*="export.view"]');
  var href = alink.getAttribute('onclick').match(/'(.+?)'/)[1];
  doGet( this, href, runFromPopup);
}


//  Respond to click in popup
function runFromPopup(ev){
  console.log(["runFromPopup", ev, this]);
  var doc = ev.__proto__ === ProgressEvent.prototype ? xhrToDoc(ev.target) : document;
  var form = doc.forms[0];
  //  Intentionally disregarding the checked-state
  var inputs = form.querySelectorAll('input[type=checkbox],input[type=submit][name*=exportButton],input[type=hidden]');
  var action = form.getAttribute('action');
  doPost( null, action, inputs, handleCsv, undefined, 'text/plain; charset=latin1');
}

//  Show the CSV contents
function handleCsv(ev) {
  console.log(ev);
  build( 'pre("?")', document.body, null, this.responseText);
}


//  Utility  ////////////////////////////////////////////////////////  

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
  console.log('Getting: '+href)
  // debugger;
  xhr = xhr || new XMLHttpRequest();
  xhr.onload = onload;
  // xhr.onreadystatechange = getXhrWatch();
  xhr.open('GET', href, true);
  xhr.send();
  return xhr;
}

function doPost( xhr, action, inputs=[], onload, override, overrideMime) {
  var merge = {};
  for( var e,i=0; e = inputs[i++];)
    merge[e.name] = e.value;
  for( var name in override)
    merge[name] = override[name];

  var sep = '--rrpsendj01';
  var data = '';
  for( var name in merge)
    data += '--' + sep + '\r\nContent-Disposition: form-data; name="' + name + '"\r\n\r\n' + merge[name] + '\r\n';
  data += '--' + sep + '--\r\n';

  console.log('Posting: '+action)
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

})()
