from flask import Flask, jsonify
from db_operations import get_tables


app = Flask(__name__)


@app.route("/getTable", methods=["GET"])
def getTable():
    table_names = get_tables()
    return jsonify({"tables": table_names}), 200


if __name__ == "__main__":
    print("Server started on port 5000")
    app.run(debug=True)
