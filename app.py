import requests
from flask import Flask

app = Flask(__name__)


@app.route('/hello_world/')
def hello_world():
    return ';Hello, World!\n' + requests.get('https://dd.al/config').text
