import sys,os
import SimpleHTTPServer as httpd


path = os.path.abspath( os.path.split( sys.argv[0])[0])
handler = httpd.SimpleHTTPRequestHandler
server = httpd.BaseHTTPServer.HTTPServer
port =  sys.argv[1:] and int(sys.argv[1]) or 7780
port = ('127.0.0.1', port)

print 'Serving on %s from %s' % ( repr(port), path)

os.chdir(path)
server(port,handler).serve_forever()

