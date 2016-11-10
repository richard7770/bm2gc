# bm2gc
Import data from DDS Blåt Medlem to Google Contacts

You should make a bookmark of [this link][injection link] and then click that link 
when browsing the 'Funktioner' tab of blaatmedlem.dk.
This will create two new groups in Google Contacts, called 'Spejdere' and 'Forældre'.

Be aware that this constitutes code injection into blaatmedlem.dk on your behalf.
You should only do this if you trust [the author] of this script.

[injection link](javascript: (function(){document.head.appendChild(document.createElement('script')).src = 'https://cdn.rawgit.com/richard7770/bm2gc/tree/0.1/load.js'})())
[the author](https://github.com/richard7770)
