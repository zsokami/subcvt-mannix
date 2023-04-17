from flask import Flask, request


def create_app():
    app = Flask(__name__)

    @app.route('/')
    def hello_world():
        a = int(request.args.get('a', 0))
        b = int(request.args.get('b', 0))
        return f'Hello, World! {a+b}'

    return app
