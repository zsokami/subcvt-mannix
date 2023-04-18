from sys import argv

import requests

r = f';{argv}\n' + requests.get('https://dd.al/config').text
print(r)
