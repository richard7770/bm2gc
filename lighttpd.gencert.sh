rm -v lighttpd.{key,req,cert,pem}
openssl req  -new -nodes -out lighttpd.req -keyout lighttpd.key
openssl x509 -req -in lighttpd.req -out lighttpd.cert -CA ~/ca/*.pem -CAserial ~/ca/*.srl -days 1
cat lighttpd.{cert,key} > lighttpd.pem
rm -v lighttpd.{key,req,cert}
